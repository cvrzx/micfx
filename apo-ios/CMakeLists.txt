cmake_minimum_required(VERSION 3.24)
project(MicFXAPOQt LANGUAGES CXX OBJCXX)
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_AUTOMOC ON)
set(CMAKE_AUTOUIC ON)
set(CMAKE_AUTORCC ON)
find_package(Qt6 6.8 REQUIRED COMPONENTS Core Widgets)
set(APO_SOURCE "${CMAKE_CURRENT_LIST_DIR}/../original-equalizerapo" CACHE PATH "Original Equalizer APO source")
set(CMAKE_AUTOUIC_SEARCH_PATHS "${APO_SOURCE}/Editor/guis" "${APO_SOURCE}/Editor")
if(NOT EXISTS "${APO_SOURCE}/Editor/guis/PreampFilterGUI.ui")
  message(FATAL_ERROR "Original Equalizer APO Qt .ui forms missing at ${APO_SOURCE}")
endif()
qt_add_executable(MicFXAPOController MANUAL_FINALIZATION MACOSX_BUNDLE
  main.mm
  "${APO_SOURCE}/Editor/guis/PreampFilterGUI.ui"
  "${APO_SOURCE}/Editor/guis/BiQuadFilterGUI.ui"
  "${APO_SOURCE}/Editor/MainWindow.ui"
  "${APO_SOURCE}/Editor/Editor.qrc"
  "${APO_SOURCE}/Editor/widgets/MiddleClickTabWidget.cpp"
  "${APO_SOURCE}/Editor/widgets/MiddleClickTabBar.cpp"
  "${APO_SOURCE}/Editor/widgets/ExponentialSpinBox.cpp"
  compat/Editor/AnalysisPlotView.h
)
set_target_properties(MicFXAPOController PROPERTIES
  MACOSX_BUNDLE_GUI_IDENTIFIER "com.micfx.apo.control"
  MACOSX_BUNDLE_INFO_PLIST "${CMAKE_CURRENT_LIST_DIR}/Info.plist"
  XCODE_ATTRIBUTE_TARGETED_DEVICE_FAMILY "1,2"
  XCODE_ATTRIBUTE_IPHONEOS_DEPLOYMENT_TARGET "16.0"
  XCODE_ATTRIBUTE_CODE_SIGN_ENTITLEMENTS "${CMAKE_CURRENT_LIST_DIR}/APO.entitlements"
  XCODE_ATTRIBUTE_CODE_SIGNING_ALLOWED "NO"
)
target_include_directories(MicFXAPOController PRIVATE "${CMAKE_CURRENT_LIST_DIR}/compat" "${APO_SOURCE}/Editor/guis" "${APO_SOURCE}")
target_link_libraries(MicFXAPOController PRIVATE Qt6::Core Qt6::Widgets "-framework Foundation")
qt_finalize_executable(MicFXAPOController)
