// Uses Equalizer APO's genuine Qt Designer preamp and biquad forms from upstream.
// Experimental iOS controller only; no Spotify capture or audio hook in this app.
#import <Foundation/Foundation.h>
#include <QApplication>
#include <QWidget>
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
#include "ui_PreampFilterGUI.h"
#include "ui_BiQuadFilterGUI.h"

static QString groupDirectory() {
    @autoreleasepool {
        NSURL *url=[[NSFileManager defaultManager] containerURLForSecurityApplicationGroupIdentifier:@"group.f172ad8c5e5f97bc.1"];
        return url ? QString::fromUtf8(url.path.UTF8String) : QString();
    }
}
class Controller : public QWidget {
    Ui::PreampFilterGUI micPre, musicPre;
    Ui::BiQuadFilterGUI biquad;
    QComboBox *route;
    QCheckBox *enabled, *muted;
    QLabel *status;
    bool initializing = true;
public:
    Controller() {
        setWindowTitle("Equalizer APO — MicFX");
        resize(780,620);
        auto *layout=new QVBoxLayout(this);
        auto *tabs=new QTabWidget(this);
        layout->addWidget(tabs);
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

        auto *saveButton=new QPushButton("Save settings for Discord",this);
        layout->addWidget(saveButton);
        status=new QLabel(this);
        status->setWordWrap(true);
        layout->addWidget(status);
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
    void save(){
        if(initializing)return;
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
