# Retrofit
-keepattributes Signature
-keepattributes *Annotation*
-keep class retrofit2.** { *; }
-keepclasseswithmembers class * { @retrofit2.http.* <methods>; }

# Gson - keep all data classes used for serialization
-keep class surf.shouldigo.app.data.model.** { *; }
-keepclassmembers class surf.shouldigo.app.data.model.** { *; }
-keep class surf.shouldigo.app.data.local.StoredSubscription { *; }
-keepclassmembers class surf.shouldigo.app.data.local.StoredSubscription { *; }
-keep class surf.shouldigo.app.data.local.SpotDataSource$* { *; }
-keepclassmembers class surf.shouldigo.app.data.local.SpotDataSource$* { *; }
-keep class surf.shouldigo.app.data.remote.SSEClient$* { *; }
-keepclassmembers class surf.shouldigo.app.data.remote.SSEClient$* { *; }

# Gson internals - needed for TypeToken reflection
-keep class com.google.gson.reflect.TypeToken { *; }
-keep class * extends com.google.gson.reflect.TypeToken
-keep class com.google.gson.internal.** { *; }
-keepattributes EnclosingMethod
-keepattributes InnerClasses

# OkHttp
-dontwarn okhttp3.**
-dontwarn okio.**

# Google Maps
-keep class com.google.android.gms.maps.** { *; }
-keep class com.google.android.gms.internal.maps.** { *; }
-keep class com.google.maps.android.compose.** { *; }
-keep interface com.google.android.gms.maps.** { *; }
-keep class com.google.android.gms.common.** { *; }
-dontwarn com.google.android.gms.**

# Firebase
-keep class com.google.firebase.** { *; }

# Hilt
-keep class dagger.hilt.** { *; }
-keep class javax.inject.** { *; }
-keep class * extends dagger.hilt.android.lifecycle.HiltViewModel
