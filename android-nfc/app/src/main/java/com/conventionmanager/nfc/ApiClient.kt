package com.conventionmanager.nfc

import com.google.gson.Gson
import com.google.gson.JsonObject
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit

class ApiClient(
    private val baseUrl: String = BuildConfig.API_BASE_URL,
    private val apiKey: String = BuildConfig.API_KEY
) {
    private val client = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(10, TimeUnit.SECONDS)
        .build()

    private val gson = Gson()
    private val jsonMediaType = "application/json; charset=utf-8".toMediaType()

    data class UserResult(
        val id: Int,
        val name: String,
        val nfcUid: String,
        val email: String?,
        val daysPlaying: Int,
        val isAdmin: Boolean,
        val voucherBalance: Int,
        val tixBalance: Int
    )

    data class ApiError(val message: String)

    suspend fun scanNfc(nfcUid: String): Result<UserResult> = withContext(Dispatchers.IO) {
        try {
            val body = gson.toJson(mapOf("nfc_uid" to nfcUid))
                .toRequestBody(jsonMediaType)

            val request = Request.Builder()
                .url("$baseUrl/scan")
                .addHeader("x-api-key", apiKey)
                .addHeader("Content-Type", "application/json")
                .post(body)
                .build()

            val response = client.newCall(request).execute()
            val responseBody = response.body?.string() ?: ""

            if (!response.isSuccessful) {
                val errorJson = try {
                    gson.fromJson(responseBody, JsonObject::class.java)
                } catch (e: Exception) { null }
                val errorMsg = errorJson?.get("error")?.asString ?: "Request failed: ${response.code}"
                return@withContext Result.failure(Exception(errorMsg))
            }

            val json = gson.fromJson(responseBody, JsonObject::class.java)
            val user = json.getAsJsonObject("user")

            val result = UserResult(
                id = user.get("id").asInt,
                name = user.get("name").asString,
                nfcUid = user.get("nfc_uid").asString,
                email = user.get("email")?.takeIf { !it.isJsonNull }?.asString,
                daysPlaying = user.get("days_playing")?.asInt ?: 1,
                isAdmin = user.get("is_admin")?.asBoolean ?: false,
                voucherBalance = user.get("voucher_balance")?.asInt ?: 0,
                tixBalance = user.get("tix_balance")?.asInt ?: 0
            )

            Result.success(result)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getBalance(nfcUid: String): Result<Pair<Int, Int>> = withContext(Dispatchers.IO) {
        try {
            val body = gson.toJson(mapOf("nfc_uid" to nfcUid))
                .toRequestBody(jsonMediaType)

            val request = Request.Builder()
                .url("$baseUrl/scan/balance")
                .addHeader("x-api-key", apiKey)
                .addHeader("Content-Type", "application/json")
                .post(body)
                .build()

            val response = client.newCall(request).execute()
            val responseBody = response.body?.string() ?: ""

            if (!response.isSuccessful) {
                val errorJson = try {
                    gson.fromJson(responseBody, JsonObject::class.java)
                } catch (e: Exception) { null }
                val errorMsg = errorJson?.get("error")?.asString ?: "Request failed: ${response.code}"
                return@withContext Result.failure(Exception(errorMsg))
            }

            val json = gson.fromJson(responseBody, JsonObject::class.java)
            val vouchers = json.get("voucher_balance")?.asInt ?: 0
            val tix = json.get("tix_balance")?.asInt ?: 0

            Result.success(Pair(vouchers, tix))
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
