// Uses Equalizer APO's genuine Qt Designer preamp and biquad forms from upstream.
// Experimental iOS controller only; no Spotify capture or audio hook in this app.
#import <Foundation/Foundation.h>
#include <QApplication>
#include <QWidget>
#include <QMainWindow>
#include <QStatusBar>
#include <QGraphicsScene>
#include <QPainterPath>
#include <QPen>
#include <QFileDialog>
#include <QStandardPaths>
#include <QTabWidget>
#include <QVBoxLayout>
#include <QHBoxLayout>
#include <QLabel>
#include <QCheckBox>
#include <QComboBox>
#include <QDial>
#include <QDoubleSpinBox>
#include <QJsonObject>
#include <QJsonArray>
#include <QJsonDocument>
#include <QSaveFile>
#include <QSignalBlocker>
#include <QDir>
#include <QPushButton>
#include <QStringList>
#include <cmath>
#include <algorithm>
#include "ui_PreampFilterGUI.h"
#include "ui_BiQuadFilterGUI.h"
#include "ui_MainWindow.h"

static QString groupDirectory() {
    @autoreleasepool {
        NSURL *url=[[NSFileManager defaultManager] containerURLForSecurityApplicationGroupIdentifier:@"group.f172ad8c5e5f97bc.1"];
        return url ? QString::fromUtf8(url.path.UTF8String) : QString();
    }
}
class Controller : public QMainWindow {
    Ui::MainWindow apoWindow;
    QGraphicsScene* graph = nullptr;
    Ui::PreampFilterGUI micPre, musicPre;
    Ui::BiQuadFilterGUI biquad;
    QComboBox *route;
    QCheckBox *enabled, *muted;
    QLabel *status;
    bool initializing = true;
public:
    Controller() {
        apoWindow.setupUi(this); // Original upstream Equalizer APO MainWindow.ui
        setWindowTitle("Equalizer APO — MicFX");
        resize(1024,768);
        auto *tabs=apoWindow.tabWidget;
        tabs->setTabsClosable(false);
        graph=new QGraphicsScene(this);
        apoWindow.graphicsView->setScene(graph);
        apoWindow.actionToolbar->setChecked(true);
        apoWindow.actionAnalysisPanel->setChecked(true);
        connect(apoWindow.actionToolbar,&QAction::toggled,apoWindow.mainToolBar,&QWidget::setVisible);
        connect(apoWindow.actionAnalysisPanel,&QAction::toggled,apoWindow.analysisDockWidget,&QWidget::setVisible);
        auto *micPage=new QWidget(this);
        auto *micLayout=new QVBoxLayout(micPage);
        auto *preWidget=new QWidget(micPage);
        micPre.setupUi(preWidget);
        micPre.dial->setFixedSize(100,66);
        micLayout->addWidget(preWidget);
        auto *biWidget=new QWidget(micPage);
        biquad.setupUi(biWidget);
        biquad.freqDial->setFixedSize(100,66);
        biquad.gainDial->setFixedSize(100,66);
        biquad.qDial->setFixedSize(100,66);
        biquad.typeComboBox->addItems({"Peaking filter","Low-pass filter","High-pass filter","Band-pass filter","Low-shelf filter","High-shelf filter","Notch filter","All-pass filter"});
        biquad.freqComboBox->addItem("Center frequency");
        biquad.qComboBox->addItem("Q factor");
        biquad.freqSpinBox->setValue(1000);
        biquad.qSpinBox->setValue(1);
        micLayout->addWidget(biWidget);
        micLayout->addStretch();
        tabs->addTab(micPage,"Equalizer APO · Mic");

        auto *musicPage=new QWidget(this);
        auto *musicLayout=new QVBoxLayout(musicPage);
        auto *musicWidget=new QWidget(musicPage);
        musicPre.setupUi(musicWidget);
        musicPre.dial->setFixedSize(100,66);
        musicLayout->addWidget(musicWidget);
        musicLayout->addWidget(new QLabel("Stereo music gain requires a permitted PCM bridge.\nThe stock Spotify app is not captured."));
        musicLayout->addStretch();
        tabs->addTab(musicPage,"MicFX · Stereo Music");

        auto *extra=new QWidget(this);
        auto *extraLayout=new QVBoxLayout(extra);
        enabled=new QCheckBox("Enable experimental Discord processing (off by default)");
        muted=new QCheckBox("Mute microphone; leave music playing");
        route=new QComboBox;
        route->addItems({"Both channels","Left only","Right only"});
        extraLayout->addWidget(enabled);
        extraLayout->addWidget(muted);
        extraLayout->addWidget(new QLabel("Microphone routing:"));
        extraLayout->addWidget(route);
        extraLayout->addWidget(new QLabel("Discord's outgoing microphone stream may be mono."));
        extraLayout->addStretch();
        tabs->addTab(extra,"MicFX · Microphone");

        auto *saveButton=new QPushButton("Apply & save settings",this);
        apoWindow.mainToolBar->addWidget(saveButton);
        status=new QLabel(this);
        status->setWordWrap(true);
        statusBar()->addWidget(status,1);
        connect(apoWindow.actionSave,&QAction::triggered,this,[this]{save();});
        connect(apoWindow.actionNew,&QAction::triggered,this,[this]{
            micPre.doubleSpinBox->setValue(0);musicPre.doubleSpinBox->setValue(0);
            biquad.gainSpinBox->setValue(0);biquad.freqSpinBox->setValue(1000);
            biquad.qSpinBox->setValue(1);muted->setChecked(false);enabled->setChecked(false);
            route->setCurrentIndex(0);save();
        });
        connectPreamp(micPre);
        connectPreamp(musicPre);
        connect(biquad.freqDial,&QDial::valueChanged,this,[this](int v){
            biquad.freqSpinBox->setValue(20.*std::pow(1000.,v/1000.));
        });
        connect(biquad.freqSpinBox,QOverload<double>::of(&QDoubleSpinBox::valueChanged),this,[this](double v){
            if(v>0){QSignalBlocker b(biquad.freqDial);biquad.freqDial->setValue(std::lround(1000.*std::log(v/20.)/std::log(1000.)));}save();
        });
        connect(biquad.gainDial,&QDial::valueChanged,this,[this](int v){biquad.gainSpinBox->setValue(v*.1);});
        connect(biquad.gainSpinBox,QOverload<double>::of(&QDoubleSpinBox::valueChanged),this,[this](double v){
            QSignalBlocker b(biquad.gainDial);biquad.gainDial->setValue(std::lround(v/.1));save();
        });
        connect(biquad.qDial,&QDial::valueChanged,this,[this](int v){biquad.qSpinBox->setValue(.3333*std::pow(100.,v/1000.));});
        connect(biquad.qSpinBox,QOverload<double>::of(&QDoubleSpinBox::valueChanged),this,[this](double v){
            if(v>0){QSignalBlocker b(biquad.qDial);biquad.qDial->setValue(std::lround(1000.*std::log(v/.3333)/std::log(100.)));}save();
        });
        connect(biquad.typeComboBox,QOverload<int>::of(&QComboBox::currentIndexChanged),this,[this](int){save();});
        connect(enabled,&QCheckBox::toggled,this,[this](bool){save();});
        connect(muted,&QCheckBox::toggled,this,[this](bool){save();});
        connect(route,QOverload<int>::of(&QComboBox::currentIndexChanged),this,[this](int){save();});
        connect(saveButton,&QPushButton::clicked,this,[this]{save();});
        initializing=false;save();
    }
    void connectPreamp(Ui::PreampFilterGUI& ui){
        connect(ui.dial,&QDial::valueChanged,this,[this,&ui](int v){ui.doubleSpinBox->setValue(v*.1);});
        connect(ui.doubleSpinBox,QOverload<double>::of(&QDoubleSpinBox::valueChanged),this,[this,&ui](double v){
            QSignalBlocker b(ui.dial);ui.dial->setValue(std::lround(v/.1));save();
        });
    }
    void updateGraph(){
        if(!graph)return;
        graph->clear();
        constexpr int W=600,H=230;
        graph->setSceneRect(0,0,W,H);
        QPen gridPen(QColor(170,170,170,85),1);
        for(int i=0;i<=6;i++)graph->addLine(0,i*H/6.,W,i*H/6.,gridPen);
        for(int i=0;i<=10;i++)graph->addLine(i*W/10.,0,i*W/10.,H,gridPen);
        // Peaking filter transfer function (RBJ Audio EQ Cookbook).
        // Other original APO filter modes display a zero reference until
        // their exact transfer functions are connected to this widget.
        double fs=48000.,fc=std::clamp(biquad.freqSpinBox->value(),20.,20000.),
          q=std::max(0.0001,biquad.qSpinBox->value()),gain=biquad.gainSpinBox->value();
        auto response=[&](double f){
            if(biquad.typeComboBox->currentIndex()!=0)return 0.;
            double A=std::pow(10.,gain/40.),w0=2.*3.141592653589793*fc/fs;
            double alpha=std::sin(w0)/(2.*q);
            double b0=1+alpha*A,b1=-2*std::cos(w0),b2=1-alpha*A;
            double a0=1+alpha/A,a1=-2*std::cos(w0),a2=1-alpha/A;
            double w=2.*3.141592653589793*f/fs;
            double nr=b0+b1*std::cos(w)+b2*std::cos(2*w),ni=-b1*std::sin(w)-b2*std::sin(2*w);
            double dr=a0+a1*std::cos(w)+a2*std::cos(2*w),di=-a1*std::sin(w)-a2*std::sin(2*w);
            return 10*std::log10(std::max(1e-20,(nr*nr+ni*ni)/(dr*dr+di*di)));
        };
        QPainterPath curve;
        for(int x=0;x<W;x++){
            double f=20.*std::pow(1000.,double(x)/(W-1));
            double db=micPre.doubleSpinBox->value()+response(f);
            double y=std::clamp(H*(.5-db/48.),0.,double(H));
            if(x==0)curve.moveTo(x,y);else curve.lineTo(x,y);
        }
        graph->addPath(curve,QPen(QColor(40,40,40),2));
        graph->addLine(0,H/2.,W,H/2.,QPen(QColor(90,90,90),1));
    }
    void save(){
        if(initializing)return;
        updateGraph();
        QString dir=groupDirectory();
        if(dir.isEmpty()){
            status->setText("App Group not authorized. Both signed apps need compatible entitlements.");
            return;
        }
        QDir().mkpath(dir);
        double gain=micPre.doubleSpinBox->value(),musicGain=musicPre.doubleSpinBox->value();
        QStringList types={"PK","LPQ","HPQ","BP","LS","HS","NO","AP"};
        QString type=types.value(biquad.typeComboBox->currentIndex(),"PK");
        double freq=biquad.freqSpinBox->value(),q=biquad.qSpinBox->value(),fg=biquad.gainSpinBox->value();
        double left=route->currentIndex()==2?0.:1.,right=route->currentIndex()==1?0.:1.;
        QJsonObject mic{{"enabled",enabled->isChecked()},{"gainDb",gain},{"mute",muted->isChecked()},{"left",left},{"right",right}};
        QJsonObject music{{"gainDb",musicGain}};
        QJsonArray filters{QJsonObject{{"type",type},{"freqHz",freq},{"gainDb",fg},{"q",q}}};
        QString config=QString("Preamp: %1 dB\nFilter: ON %2 Fc %3 Hz Gain %4 dB Q %5\n").arg(gain).arg(type).arg(freq).arg(fg).arg(q);
        QJsonObject root{{"schema",1},{"mic",mic},{"music",music},{"eq",QJsonObject{{"filters",filters}}},{"configText",config}};
        QByteArray bytes=QJsonDocument(root).toJson(QJsonDocument::Indented);
        QSaveFile file(dir+"/micfx-control-v1.json");
        if(!file.open(QIODevice::WriteOnly)||file.write(bytes)!=bytes.size()||!file.commit())
            status->setText("Failed to save settings into shared App Group.");
        else
            status->setText("Saved shared settings. Discord native hook still needs device testing.");
    }
};
int main(int argc,char**argv){
    QApplication app(argc,argv);
    Controller controller;
    controller.show();
    return app.exec();
}
