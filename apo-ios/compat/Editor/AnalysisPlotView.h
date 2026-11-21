#pragma once
// Qt-only compatibility adapter for the APO AnalysisPlotView in the iOS port.
// The original Windows AnalysisPlotView.cpp depends on its desktop filter graph
// engine. This adapter keeps the original MainWindow.ui layout compilable;
// a live response graph is provided by the controller.
#include <QGraphicsView>
class AnalysisPlotView : public QGraphicsView {
public:
    explicit AnalysisPlotView(QWidget* parent = nullptr):QGraphicsView(parent) {
        setRenderHint(QPainter::Antialiasing,true);
        setDragMode(QGraphicsView::NoDrag);
    }
};
