# Retrofit
-keepattributes Signature
-keepattributes *Annotation*
-keep class retrofit2.** { *; }
-keepclasseswithmembers class * { @retrofit2.http.* <methods>; }

# Gson
-keep class surf.shouldigo.app.data.model.** { *; }
-keepclassmembers class surf.shouldigo.app.data.model.** { *; }

# OkHttp
-dontwarn okhttp3.**
-dontwarn okio.**

# Firebase
-keep class com.google.firebase.** { *; }
