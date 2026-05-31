package ai.oppa.obaagent

import android.app.Activity
import android.os.Bundle
import android.widget.TextView

class MainActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val view = TextView(this).apply {
            text = "OBA Agent\n\nMVP: push-to-talk speech input -> Agent Gateway /turn"
            textSize = 18f
            setPadding(48, 72, 48, 48)
        }

        setContentView(view)
    }
}
