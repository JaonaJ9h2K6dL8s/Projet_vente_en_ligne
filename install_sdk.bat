set JAVA_HOME=D:\android-build-env\jdk17
set ANDROID_HOME=D:\android-build-env\android-sdk
set SDKMANAGER=D:\android-build-env\android-sdk\cmdline-tools\latest\bin\sdkmanager.bat

echo y | "%SDKMANAGER%" "platforms;android-36" "build-tools;35.0.0"
echo y | "%SDKMANAGER%" --licenses
