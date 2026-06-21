package com.smartags.tvplayer

import org.json.JSONObject

data class WidgetRuntimeEnv(
    val weatherApiKey: String? = null,
    val tenantNewsFeedUrls: List<String> = emptyList()
)

data class WeatherRenderModel(
    val locationName: String,
    val temperatureText: String,
    val description: String,
    val highLowText: String? = null,
    val humidityText: String? = null,
    val windText: String? = null
)

data class NewsRenderModel(
    val title: String,
    val items: List<String>
)

object WidgetHtmlFactory {
    fun build(widget: WidgetModel, env: WidgetRuntimeEnv = WidgetRuntimeEnv(), weather: WeatherRenderModel? = null, news: NewsRenderModel? = null): String {
        val cfg = widget.config
        return when (widget.type.uppercase()) {
            "TIME_DATE" -> timeDate(cfg)
            "ANALOG_CLOCK" -> analogClock(cfg)
            "COUNT_DOWN" -> countDown(cfg)
            "YOUTUBE" -> youtube(cfg)
            "WEATHER" -> weather(cfg, weather, env)
            "NEWS" -> news(cfg, news, env)
            else -> unsupported(widget.type)
        }
    }

    fun shouldUseNativeQr(widget: WidgetModel): Boolean = widget.type.equals("QR_CODE", true)

    private fun shell(body: String, background: String = "#000000"): String = """
        <!doctype html>
        <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <style>
            html, body { margin:0; padding:0; width:100%; height:100%; overflow:hidden; background:${background}; }
            body { font-family: Arial, sans-serif; color: white; }
            .root { width:100%; height:100%; display:flex; align-items:center; justify-content:center; }
          </style>
        </head>
        <body>${body}</body>
        </html>
    """.trimIndent()

    private fun timeDate(cfg: JSONObject): String {
        val background = cfg.optString("backgroundColor", "#101010")
        val text = cfg.optString("textColor", "#FFFFFF")
        val showDate = cfg.optBoolean("showDate", true)
        val showTime = cfg.optBoolean("showTime", true)
        val timeFormat = cfg.optString("timeFormat", "24h")
        val align = when (cfg.optString("textAlign", "center")) {
            "left" -> "flex-start"
            "right" -> "flex-end"
            else -> "center"
        }
        val dateOptions = when (cfg.optString("dateFormat", "long")) {
            "short" -> "{ dateStyle: 'short' }"
            "medium" -> "{ dateStyle: 'medium' }"
            "full" -> "{ dateStyle: 'full' }"
            else -> "{ dateStyle: 'long' }"
        }
        val body = """
          <div class="root" style="background:${background}; justify-content:${align};">
            <div style="width:100%; padding:4vw; text-align:${cfg.optString("textAlign", "center")}; color:${text};">
              <div id="time" style="font-size:10vh; font-weight:700; display:${if (showTime) "block" else "none"};"></div>
              <div id="date" style="font-size:3.5vh; opacity:.85; margin-top:1vh; display:${if (showDate) "block" else "none"};"></div>
            </div>
          </div>
          <script>
            function tick() {
              const now = new Date();
              const time = now.toLocaleTimeString([], { hour: '2-digit', minute:'2-digit', second:'2-digit', hour12: ${timeFormat == "12h"} });
              const date = now.toLocaleDateString([], ${dateOptions});
              document.getElementById('time').textContent = time;
              document.getElementById('date').textContent = date;
            }
            tick();
            setInterval(tick, 1000);
          </script>
        """.trimIndent()
        return shell(body, background)
    }

    private fun analogClock(cfg: JSONObject): String {
        val background = cfg.optString("backgroundColor", "#FFFFFF")
        val tick = cfg.optString("analogTickColor", "#888888")
        val hourColor = cfg.optString("analogHandHourColor", cfg.optString("textColor", "#000000"))
        val minuteColor = cfg.optString("analogHandMinuteColor", cfg.optString("textColor", "#000000"))
        val secondColor = cfg.optString("analogHandSecondColor", "#ff4d4f")
        val showSecond = cfg.optBoolean("analogShowSecondHand", true)
        val showNumbers = cfg.optBoolean("analogShowNumbers", true)
        val body = """
          <div class="root" style="background:${background};">
            <canvas id="clock" width="600" height="600" style="max-width:100%; max-height:100%;"></canvas>
          </div>
          <script>
            const canvas = document.getElementById('clock');
            const ctx = canvas.getContext('2d');
            function draw() {
              const w = canvas.width, h = canvas.height, c = w / 2, r = w * 0.42;
              const now = new Date();
              ctx.clearRect(0,0,w,h);
              ctx.fillStyle = '${background}';
              ctx.fillRect(0,0,w,h);
              ctx.save();
              ctx.translate(c,c);
              ctx.strokeStyle = '${tick}';
              for (let i=0; i<60; i++) {
                ctx.beginPath();
                ctx.lineWidth = i % 5 === 0 ? 6 : 2;
                ctx.moveTo(0, -r);
                ctx.lineTo(0, -(i % 5 === 0 ? r - 26 : r - 12));
                ctx.stroke();
                ctx.rotate(Math.PI / 30);
              }
              if (${showNumbers}) {
                ctx.fillStyle = '${hourColor}';
                ctx.font = 'bold 38px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                for (let n=1; n<=12; n++) {
                  const ang = n * Math.PI / 6;
                  ctx.fillText(String(n), Math.sin(ang) * (r - 58), -Math.cos(ang) * (r - 58));
                }
              }
              const hour = now.getHours() % 12 + now.getMinutes() / 60;
              const minute = now.getMinutes() + now.getSeconds() / 60;
              const second = now.getSeconds();
              function hand(angle, len, width, color) {
                ctx.save();
                ctx.rotate(angle);
                ctx.beginPath();
                ctx.lineWidth = width;
                ctx.lineCap = 'round';
                ctx.strokeStyle = color;
                ctx.moveTo(0, 18);
                ctx.lineTo(0, -len);
                ctx.stroke();
                ctx.restore();
              }
              hand(hour * Math.PI / 6, r * 0.48, 12, '${hourColor}');
              hand(minute * Math.PI / 30, r * 0.72, 8, '${minuteColor}');
              if (${showSecond}) hand(second * Math.PI / 30, r * 0.8, 4, '${secondColor}');
              ctx.beginPath();
              ctx.fillStyle = '${minuteColor}';
              ctx.arc(0,0,10,0,Math.PI*2);
              ctx.fill();
              ctx.restore();
            }
            draw();
            setInterval(draw, 1000);
          </script>
        """.trimIndent()
        return shell(body, background)
    }

    private fun countDown(cfg: JSONObject): String {
        val background = cfg.optString("backgroundColor", "#101010")
        val text = cfg.optString("textColor", "#FFFFFF")
        val target = cfg.optString("timerTargetDate", "")
        val mode = cfg.optString("timerMode", "COUNT_DOWN")
        val label = escape(cfg.optString("timerLabel", if (mode == "COUNT_DOWN") "Time Remaining" else "Time Elapsed"))
        val showLabel = cfg.optBoolean("timerShowLabel", true)
        val finishMessage = escape(cfg.optString("timerFinishMessage", "Time is up!"))
        val body = """
          <div class="root" style="background:${background}; color:${text};">
            <div style="width:100%; text-align:center; padding:4vw;">
              <div id="label" style="font-size:3vh; opacity:.8; display:${if (showLabel) "block" else "none"};">${label}</div>
              <div id="value" style="font-size:9vh; font-weight:700; margin-top:2vh;">--:--:--</div>
            </div>
          </div>
          <script>
            const target = ${if (target.isBlank()) "Date.now() + 86400000" else "new Date('${escapeJs(target)}').getTime()"};
            const mode = '${mode}';
            const finishMessage = '${escapeJs(finishMessage)}';
            function tick() {
              const now = Date.now();
              let diff = mode === 'COUNT_DOWN' ? (target - now) : (now - target);
              if (mode === 'COUNT_DOWN' && diff <= 0) {
                document.getElementById('value').textContent = finishMessage;
                return;
              }
              if (diff < 0) diff = Math.abs(diff);
              const days = Math.floor(diff / 86400000);
              const hours = Math.floor((diff / 3600000) % 24);
              const mins = Math.floor((diff / 60000) % 60);
              const secs = Math.floor((diff / 1000) % 60);
              const prefix = days > 0 ? days + 'd ' : '';
              document.getElementById('value').textContent = prefix + String(hours).padStart(2,'0') + ':' + String(mins).padStart(2,'0') + ':' + String(secs).padStart(2,'0');
            }
            tick();
            setInterval(tick, 1000);
          </script>
        """.trimIndent()
        return shell(body, background)
    }

    private fun youtube(cfg: JSONObject): String {
        val url = cfg.optString("youtubeUrl", "")
        val embedUrl = toYoutubeEmbed(url, cfg)
        if (embedUrl.isBlank()) return unsupported("YOUTUBE")
        val body = """
          <div class="root" style="background:#000;">
            <iframe src="$embedUrl" style="border:0;width:100%;height:100%;" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>
          </div>
        """.trimIndent()
        return shell(body, "#000000")
    }

    private fun weather(cfg: JSONObject, model: WeatherRenderModel?, env: WidgetRuntimeEnv): String {
        val background = cfg.optString("backgroundColor", "#0F172A")
        val text = cfg.optString("textColor", "#FFFFFF")
        val accent = cfg.optString("weatherAccentColor", "#38BDF8")
        val title = escape(cfg.optString("weatherTitle", "Weather"))
        if (model == null) {
            val hint = if (env.weatherApiKey.isNullOrBlank()) {
                "Weather API key missing"
            } else {
                "Weather data unavailable"
            }
            return unsupportedCard(title, hint, background, text)
        }
        val body = """
          <div class="root" style="background:${background}; color:${text};">
            <div style="width:100%; height:100%; padding:4vh 4vw; box-sizing:border-box; display:flex; flex-direction:column; justify-content:center;">
              <div style="font-size:3vh; opacity:.8;">${title}</div>
              <div style="font-size:5vh; font-weight:700; margin-top:1vh;">${escape(model.locationName)}</div>
              <div style="font-size:11vh; font-weight:800; color:${accent}; line-height:1.05; margin-top:1vh;">${escape(model.temperatureText)}</div>
              <div style="font-size:3.4vh; margin-top:1vh;">${escape(model.description)}</div>
              <div style="display:flex; flex-wrap:wrap; gap:1.2vw; margin-top:2.2vh; font-size:2.6vh; opacity:.86;">
                ${model.highLowText?.let { "<div>${escape(it)}</div>" } ?: ""}
                ${model.humidityText?.let { "<div>${escape(it)}</div>" } ?: ""}
                ${model.windText?.let { "<div>${escape(it)}</div>" } ?: ""}
              </div>
            </div>
          </div>
        """.trimIndent()
        return shell(body, background)
    }

    private fun news(cfg: JSONObject, model: NewsRenderModel?, env: WidgetRuntimeEnv): String {
        val background = cfg.optString("backgroundColor", "#111827")
        val text = cfg.optString("textColor", "#FFFFFF")
        val accent = cfg.optString("newsAccentColor", "#22C55E")
        val heading = escape(model?.title ?: cfg.optString("newsTitle", "News"))
        val items = model?.items?.take(8).orEmpty()
        if (items.isEmpty()) {
            val hint = if (env.tenantNewsFeedUrls.isEmpty() && cfg.optString("newsFeedUrl", "").isBlank()) {
                "No news feeds configured"
            } else {
                "News feed unavailable"
            }
            return unsupportedCard(heading, hint, background, text)
        }
        val rows = items.joinToString("") {
            "<div style=\"padding:1.3vh 0; border-bottom:1px solid rgba(255,255,255,0.08);\">${escape(it)}</div>"
        }
        val body = """
          <div class="root" style="background:${background}; color:${text}; align-items:stretch;">
            <div style="width:100%; height:100%; padding:3.5vh 3vw; box-sizing:border-box; display:flex; flex-direction:column;">
              <div style="font-size:3vh; font-weight:700; color:${accent}; margin-bottom:1.8vh;">${heading}</div>
              <div style="font-size:2.8vh; line-height:1.35; overflow:hidden;">${rows}</div>
            </div>
          </div>
        """.trimIndent()
        return shell(body, background)
    }

    private fun toYoutubeEmbed(url: String, cfg: JSONObject): String {
        val regexes = listOf(
            Regex("""(?:youtube\.com/watch\?v=|youtu\.be/)([^&\n?#]+)"""),
            Regex("""youtube\.com/embed/([^&\n?#]+)"""),
            Regex("""youtube\.com/v/([^&\n?#]+)""")
        )
        val videoId = regexes.firstNotNullOfOrNull { it.find(url)?.groupValues?.getOrNull(1) } ?: return ""
        val params = mutableListOf(
            "autoplay=1",
            "controls=${if (cfg.optBoolean("youtubeShowControls", false)) 1 else 0}",
            "rel=0"
        )
        if (cfg.optBoolean("youtubeMuted", true)) params += "mute=1"
        if (cfg.optBoolean("youtubeLoop", true)) {
            params += "loop=1"
            params += "playlist=$videoId"
        }
        return "https://www.youtube.com/embed/$videoId?${params.joinToString("&")}"
    }

    private fun unsupported(type: String): String = shell(
        """
        <div class="root" style="background:#111;">
          <div style="text-align:center; color:#fff;">
            <div style="font-size:5vh; font-weight:700;">$type</div>
            <div style="font-size:2.5vh; opacity:.7; margin-top:1vh;">Widget not yet supported natively</div>
          </div>
        </div>
        """.trimIndent(),
        "#111111"
    )

    private fun unsupportedCard(title: String, message: String, background: String, text: String): String = shell(
        """
        <div class="root" style="background:${background}; color:${text};">
          <div style="text-align:center; padding:3vh 3vw;">
            <div style="font-size:4.5vh; font-weight:700;">${title}</div>
            <div style="font-size:2.4vh; opacity:.78; margin-top:1.2vh;">${escape(message)}</div>
          </div>
        </div>
        """.trimIndent(),
        background
    )

    private fun escape(input: String): String = input
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")

    private fun escapeJs(input: String): String = input
        .replace("\\", "\\\\")
        .replace("'", "\\'")
        .replace("\n", "\\n")
}
