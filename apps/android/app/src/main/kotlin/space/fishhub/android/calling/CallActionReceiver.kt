package space.fishhub.android.calling

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import space.fishhub.android.FishApplication
import space.fishhub.android.MainActivity

class CallActionReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val callId = intent.getStringExtra(CallIntents.ExtraCallId) ?: return
        val coordinator = (context.applicationContext as FishApplication).callCoordinator
        when (intent.action) {
            CallIntents.ActionAnswer -> context.startActivity(
                Intent(context, MainActivity::class.java)
                    .setAction(CallIntents.ActionAnswer)
                    .putExtras(intent)
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP),
            )
            CallIntents.ActionReject -> coordinator.reject(callId)
            CallIntents.ActionEnd -> coordinator.end(callId)
        }
    }
}
