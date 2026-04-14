package com.conventionmanager.nfc

import android.content.Intent
import android.nfc.NfcAdapter
import android.os.Bundle
import android.view.View
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.launch

class MainActivity : AppCompatActivity() {

    private var nfcAdapter: NfcAdapter? = null
    private val apiClient = ApiClient()

    // Views
    private lateinit var statusText: TextView
    private lateinit var scanPrompt: TextView
    private lateinit var progressBar: ProgressBar
    private lateinit var resultCard: LinearLayout
    private lateinit var playerName: TextView
    private lateinit var nfcUidText: TextView
    private lateinit var voucherBalance: TextView
    private lateinit var tixBalance: TextView
    private lateinit var playerDetails: TextView
    private lateinit var refreshButton: Button

    private var lastScannedUid: String? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        buildUi()

        nfcAdapter = NfcHelper.getNfcAdapter(this)

        if (nfcAdapter == null) {
            statusText.text = "NFC not available on this device"
            statusText.setTextColor(0xFFE53935.toInt())
        } else if (!nfcAdapter!!.isEnabled) {
            statusText.text = "NFC is disabled. Please enable it in Settings."
            statusText.setTextColor(0xFFFFA726.toInt())
        } else {
            statusText.text = "NFC Ready"
            statusText.setTextColor(0xFF43A047.toInt())
        }

        // Handle NFC intent if app was launched by tag
        handleNfcIntent(intent)
    }

    private fun buildUi() {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(48, 64, 48, 48)
            setBackgroundColor(0xFFF5F5F5.toInt())
        }

        // Title
        root.addView(TextView(this).apply {
            text = "Convention NFC Scanner"
            textSize = 24f
            setTextColor(0xFF212121.toInt())
            textAlignment = View.TEXT_ALIGNMENT_CENTER
        })

        // Status indicator
        statusText = TextView(this).apply {
            text = "Initializing..."
            textSize = 14f
            textAlignment = View.TEXT_ALIGNMENT_CENTER
            setPadding(0, 16, 0, 32)
        }
        root.addView(statusText)

        // Scan prompt
        scanPrompt = TextView(this).apply {
            text = "\uD83D\uDCF1 Hold an NFC tag near the device"
            textSize = 18f
            setTextColor(0xFF616161.toInt())
            textAlignment = View.TEXT_ALIGNMENT_CENTER
            setPadding(0, 48, 0, 48)
        }
        root.addView(scanPrompt)

        // Progress bar
        progressBar = ProgressBar(this).apply {
            visibility = View.GONE
        }
        root.addView(progressBar)

        // Result card
        resultCard = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(32, 32, 32, 32)
            setBackgroundColor(0xFFFFFFFF.toInt())
            visibility = View.GONE
        }

        playerName = TextView(this).apply {
            textSize = 22f
            setTextColor(0xFF212121.toInt())
            textAlignment = View.TEXT_ALIGNMENT_CENTER
        }
        resultCard.addView(playerName)

        nfcUidText = TextView(this).apply {
            textSize = 12f
            setTextColor(0xFF9E9E9E.toInt())
            textAlignment = View.TEXT_ALIGNMENT_CENTER
            setPadding(0, 4, 0, 24)
        }
        resultCard.addView(nfcUidText)

        // Balances row
        val balancesRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            setPadding(0, 0, 0, 16)
        }

        val voucherBox = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(16, 16, 16, 16)
            setBackgroundColor(0xFFE8F5E9.toInt())
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply {
                setMargins(0, 0, 8, 0)
            }
        }
        voucherBox.addView(TextView(this).apply {
            text = "Vouchers"
            textSize = 12f
            setTextColor(0xFF2E7D32.toInt())
            textAlignment = View.TEXT_ALIGNMENT_CENTER
        })
        voucherBalance = TextView(this).apply {
            text = "0"
            textSize = 28f
            setTextColor(0xFF1B5E20.toInt())
            textAlignment = View.TEXT_ALIGNMENT_CENTER
        }
        voucherBox.addView(voucherBalance)
        balancesRow.addView(voucherBox)

        val tixBox = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(16, 16, 16, 16)
            setBackgroundColor(0xFFF3E5F5.toInt())
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply {
                setMargins(8, 0, 0, 0)
            }
        }
        tixBox.addView(TextView(this).apply {
            text = "Tix"
            textSize = 12f
            setTextColor(0xFF7B1FA2.toInt())
            textAlignment = View.TEXT_ALIGNMENT_CENTER
        })
        tixBalance = TextView(this).apply {
            text = "0"
            textSize = 28f
            setTextColor(0xFF4A148C.toInt())
            textAlignment = View.TEXT_ALIGNMENT_CENTER
        }
        tixBox.addView(tixBalance)
        balancesRow.addView(tixBox)

        resultCard.addView(balancesRow)

        playerDetails = TextView(this).apply {
            textSize = 13f
            setTextColor(0xFF757575.toInt())
            setPadding(0, 8, 0, 16)
        }
        resultCard.addView(playerDetails)

        refreshButton = Button(this).apply {
            text = "Refresh Balance"
            setOnClickListener {
                lastScannedUid?.let { uid -> lookupUser(uid) }
            }
        }
        resultCard.addView(refreshButton)

        root.addView(resultCard)

        setContentView(root)
    }

    override fun onResume() {
        super.onResume()
        nfcAdapter?.let { NfcHelper.enableForegroundDispatch(this, it) }
    }

    override fun onPause() {
        super.onPause()
        nfcAdapter?.let { NfcHelper.disableForegroundDispatch(this, it) }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleNfcIntent(intent)
    }

    private fun handleNfcIntent(intent: Intent) {
        val action = intent.action ?: return

        if (action == NfcAdapter.ACTION_TAG_DISCOVERED ||
            action == NfcAdapter.ACTION_TECH_DISCOVERED ||
            action == NfcAdapter.ACTION_NDEF_DISCOVERED
        ) {
            val uid = NfcHelper.extractTagUid(intent)
            if (uid != null) {
                lastScannedUid = uid
                Toast.makeText(this, "Tag scanned: $uid", Toast.LENGTH_SHORT).show()
                lookupUser(uid)
            } else {
                Toast.makeText(this, "Could not read tag UID", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun lookupUser(nfcUid: String) {
        progressBar.visibility = View.VISIBLE
        resultCard.visibility = View.GONE
        scanPrompt.text = "Looking up $nfcUid..."

        lifecycleScope.launch {
            val result = apiClient.scanNfc(nfcUid)

            progressBar.visibility = View.GONE

            result.onSuccess { user ->
                scanPrompt.text = "Tap another tag to scan"
                resultCard.visibility = View.VISIBLE

                playerName.text = user.name
                nfcUidText.text = user.nfcUid
                voucherBalance.text = user.voucherBalance.toString()
                tixBalance.text = user.tixBalance.toString()

                val details = buildString {
                    append("Days Playing: ${user.daysPlaying}")
                    user.email?.let { append(" | Email: $it") }
                    if (user.isAdmin) append(" | ADMIN")
                }
                playerDetails.text = details
            }

            result.onFailure { error ->
                scanPrompt.text = "Hold an NFC tag near the device"
                resultCard.visibility = View.GONE
                Toast.makeText(
                    this@MainActivity,
                    "Error: ${error.message}",
                    Toast.LENGTH_LONG
                ).show()
            }
        }
    }
}
