// Core references
const body = document.body;
const modeToggle = document.getElementById("modeToggle");
const audioToggle = document.getElementById("audioToggle");
const audioStatus = document.getElementById("audioStatus");
const audio = document.getElementById("asmrAudio");
const audio2 = document.getElementById("asmrAudio2");
const orb = document.getElementById("orb");
const copyPromptBtn = document.getElementById("copyPrompt");
const copyStatus = document.getElementById("copyStatus");
const wave = document.querySelector(".wave");
const reveals = document.querySelectorAll(".reveal");
const hero = document.getElementById("hero");
const parallaxLayers = document.querySelectorAll("[data-speed]");
const snapSections = [hero, ...document.querySelectorAll(".section")].filter(Boolean);
const promptText = document.getElementById("promptText");
const progressBar = document.getElementById("progressBar");
const matrixEl = document.querySelector(".matrix");
const heroTitleEl = hero?.querySelector("h1");
const snoreBtn = document.getElementById("snoreBtn");
const asmrBtn = document.getElementById("asmrBtn");
const clickHint = document.getElementById("clickHint");

// Calculator references
const sleepForm = document.getElementById("sleepForm");
const bedtimeInput = document.getElementById("bedtime");
const wakeInput = document.getElementById("waketime");
const screenHoursInput = document.getElementById("screenHours");
const screenCutoffInput = document.getElementById("screenCutoff");
const ratingEl = document.getElementById("sleepRating");
const ratingCopy = document.getElementById("sleepHoursCopy");
const summaryEl = document.getElementById("sleepSummary");
const adviceEl = document.getElementById("sleepAdvice");
const sleepBar = document.getElementById("sleepBar");
const screenBar = document.getElementById("screenBar");
const sleepMeta = document.getElementById("sleepHoursMeta");
const screenMeta = document.getElementById("screenMeta");
const calcError = document.getElementById("calcError");

let introPlayed = false;
let snapping = false;
let experienceStarted = false;
let autoplayTries = 0;
let unlockArmed = false;
const userSignals = ["pointerdown", "click", "keydown", "mousemove", "wheel", "touchstart", "scroll", "touchmove"];

const adviceBank = {
  shortHigh: "It looks like you're only getting about 6 hours of sleep, and screens are heavy. Try trimming screens to under an hour before bed and add 30 minutes more sleep tonight.",
  adequateLow: "Great job staying near 8-9 hours with low screen use. Keep brightness low in the last hour and consider swapping some scroll time for a book or music.",
  moderate: "You're around 7 hours or have a couple hours of screens. Tighten your schedule, cap screens in the last hour, and add a small pre-bed wind-down.",
  irregular: "Your schedule looks irregular. Aim for a consistent bedtime/wake time within about 30 minutes, and protect that window like an appointment."
};

// Sun鈥揗oon orbit points (vw/vh)
const START = { x: 13.0, y: 19.6 };
const END = { x: 88.9, y: 24.9 };
const CENTER = { x: 50.3, y: 99.5 };

function startSunMoonOrbit() {
  if (introPlayed) return;
  introPlayed = true;
  if (!orb) return;

  const radius = Math.hypot(START.x - CENTER.x, START.y - CENTER.y);
  const thetaStart = Math.atan2(START.y - CENTER.y, START.x - CENTER.x);
  const thetaEnd = Math.atan2(END.y - CENTER.y, END.x - CENTER.x);
  const thetaMid = thetaStart + Math.PI; // opposite side

  const duration = 7000;
  const startTime = performance.now();

  function frame(now) {
    const elapsed = now - startTime;
    let t = elapsed / duration;
    if (t > 1) t = 1;

    let theta;
    if (t <= 0.5) {
      const local = t / 0.5;
      theta = thetaStart + Math.PI * local; // 180掳
      orb.dataset.phase = "sun";
    } else {
      const local = (t - 0.5) / 0.5;
      theta = thetaMid + (thetaEnd - thetaMid) * local;
      orb.dataset.phase = "moon";
    }

    const x = CENTER.x + radius * Math.cos(theta);
    const y = CENTER.y + radius * Math.sin(theta);
    orb.style.transform = `translate(${x}vw, ${y}vh)`;

    const phase = t;
    document.documentElement.style.setProperty("--sky-phase", phase);
    body.style.setProperty("--phase", phase.toFixed(3));

    if (t < 1) {
      requestAnimationFrame(frame);
    } else {
      body.classList.add("night");
      if (modeToggle) {
        modeToggle.classList.add("is-on");
        modeToggle.setAttribute("aria-pressed", "true");
        const label = modeToggle.querySelector(".toggle-label");
        if (label) label.textContent = "Night mode";
      }
    }
  }

  requestAnimationFrame(frame);
}

// Load: autoplay, draw chart, then start orbit after 3s
window.addEventListener("load", () => {
  setAudioVolumes();
  drawChart();
  drawMetricsChart();
  initCalculator();
  fillProgressBars();
  updateProgress();
  initGsap();
  animateMatrix();
  animateHeroFlip();
  updateTopAudioButtons();
  attemptAutoplay();
  setTimeout(() => startExperience(), 1200);
});

// Manual day/night toggle
if (modeToggle) {
  modeToggle.addEventListener("click", () => {
    const isNight = !body.classList.contains("night");
    body.classList.toggle("night", isNight);
    const phase = isNight ? 1 : 0;
    document.documentElement.style.setProperty("--sky-phase", phase);
    body.style.setProperty("--phase", phase.toString());
    modeToggle.classList.toggle("is-on", isNight);
    modeToggle.setAttribute("aria-pressed", String(isNight));
    const label = modeToggle.querySelector(".toggle-label");
    if (label) label.textContent = isNight ? "Night mode" : "Day mode";
  });
}

// Helper: try to play both tracks, keeping them muted first (autoplay friendly)
function playTracks({ fromGesture = false } = {}) {
  if (!audio) return Promise.reject();

  // Keep muted on first tries; unmute after playback begins
  if (!fromGesture) {
    audio.muted = true;
    if (audio2) audio2.muted = true;
  }

  const attempts = [audio.play?.()];
  if (audio2) attempts.push(audio2.play?.());

  return Promise.allSettled(attempts).then(results => {
    const anyRejected = results.some(r => r.status === "rejected");
    const anyPaused = [audio, audio2].some(t => t && t.paused);
    if (anyRejected || anyPaused) {
      return Promise.reject();
    }
    // Unmute shortly after autoplay succeeds
    setTimeout(() => {
      audio.muted = false;
      if (audio2) audio2.muted = false;
    }, fromGesture ? 40 : 180);
    setAudioState(true);
    startExperience();
    updateTopAudioButtons();
    return Promise.resolve();
  });
}

// Autoplay audio; if blocked, retry on the first user gesture
function attemptAutoplay() {
  if (!audio) return;
  playTracks({ fromGesture: false }).catch(() => {
    setAudioState(false);
    if (!unlockArmed) {
      unlockArmed = true;
      const unlock = () => {
        playTracks({ fromGesture: true }).finally(() => {
          userSignals.forEach(sig => window.removeEventListener(sig, unlock));
          unlockArmed = false;
        });
      };
      userSignals.forEach(sig => window.addEventListener(sig, unlock, { once: true, passive: true }));
    }
    if (autoplayTries < 3) {
      autoplayTries += 1;
      setTimeout(attemptAutoplay, 1200);
    }
  });
}

function setAudioState(on) {
  if (on) {
    if (audioStatus) audioStatus.textContent = "Playing";
    if (audioToggle) {
      audioToggle.classList.add("is-on");
      audioToggle.setAttribute("aria-pressed", "true");
      const label = audioToggle.querySelector(".toggle-label");
      if (label) label.textContent = "Sound on";
    }
    if (wave) wave.classList.add("playing");
  } else {
    if (audioStatus) audioStatus.textContent = "Muted";
    if (audioToggle) {
      audioToggle.classList.remove("is-on");
      audioToggle.setAttribute("aria-pressed", "false");
      const label = audioToggle.querySelector(".toggle-label");
      if (label) label.textContent = "Sound off";
    }
    if (wave) wave.classList.remove("playing");
  }
  if (on) hideClickHint();
}

function startExperience() {
  if (experienceStarted) return;
  experienceStarted = true;
  startSunMoonOrbit();
}

if (audioToggle && audio && audioStatus) {
  audioToggle.addEventListener("click", async () => {
    const wantsPlay = !audioToggle.classList.contains("is-on");
    try {
      if (wantsPlay) {
        await Promise.all([audio.play(), audio2?.play?.()]);
        setAudioState(true);
      } else {
        audio.pause();
        audio2?.pause?.();
        setAudioState(false);
      }
      updateTopAudioButtons();
    } catch {
      setAudioState(false);
      audioStatus.textContent = "Tap again to allow audio";
    }
  });
}

// Trigger autoplay on wheel if still blocked
window.addEventListener("wheel", () => {
  if (audio && audio.paused) {
    attemptAutoplay();
  }
}, { passive: true });

// Hide the click hint on first interaction even if audio stays blocked
userSignals.forEach(sig => {
  window.addEventListener(sig, () => hideClickHint(), { once: true, passive: true });
});

// Silence autoplay rejections (common when browser blocks sound before a gesture)
window.addEventListener("unhandledrejection", evt => {
  const msg = String(evt.reason || "");
  if (msg.includes("NotAllowedError") || msg.includes("play() failed") || msg === "undefined") {
    console.info("Autoplay was blocked by the browser; waiting for a user gesture to unlock audio.");
    evt.preventDefault();
  }
});

// Copy prompt helper
if (copyPromptBtn && copyStatus) {
  copyPromptBtn.addEventListener("click", async () => {
    const text = promptText?.textContent || "";
    try {
      await navigator.clipboard.writeText(text.trim());
      copyStatus.textContent = "Prompt copied.";
    } catch {
      copyStatus.textContent = "Copy not available in this browser.";
    }
    setTimeout(() => (copyStatus.textContent = ""), 2200);
  });
}

// Sleep calculator helpers
function toMinutes(timeStr) {
  if (!timeStr) return null;
  const [h, m] = timeStr.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

function hoursBetween(start, end) {
  if (start === null || end === null) return null;
  let finish = end;
  if (finish <= start) finish += 1440;
  return (finish - start) / 60;
}

function shortestGapHours(bedMinutes, cutoffMinutes) {
  if (bedMinutes === null || cutoffMinutes === null) return null;
  const raw = Math.abs(bedMinutes - cutoffMinutes);
  const wrapped = 1440 - raw;
  return Math.min(raw, wrapped) / 60;
}

function setBar(el, percent) {
  if (!el) return;
  el.style.width = `${Math.max(0, Math.min(percent, 100))}%`;
}

function deriveRating(sleepHours, screenHours, gapHours) {
  const safeScreen = screenHours <= 1;
  const gapSafe = gapHours === null ? false : gapHours >= 0.75;
  if (sleepHours >= 8 && sleepHours <= 10 && safeScreen && gapSafe) {
    return { label: "Sleep Star", className: "good", copy: "Nice! Solid sleep span and low screen pressure before bed." };
  }
  if (sleepHours >= 7.5 && screenHours <= 2) {
    return { label: "On Track", className: "ok", copy: "You're close. A little more sleep or earlier screen cutoff can boost recovery." };
  }
  return { label: "Needs Improvement", className: "poor", copy: "Sleep is short or screens run late. Tweak timing to feel better tomorrow." };
}

function pickAdvice(sleepHours, screenHours, gapHours) {
  if (sleepHours !== null && (sleepHours < 5 || sleepHours > 10 || (gapHours !== null && gapHours > 6))) {
    return adviceBank.irregular;
  }
  if (sleepHours !== null && sleepHours < 6.5 && screenHours >= 2.5) {
    return adviceBank.shortHigh;
  }
  if (sleepHours !== null && sleepHours >= 8 && sleepHours <= 10 && screenHours <= 1.25 && (gapHours === null || gapHours >= 0.75)) {
    return adviceBank.adequateLow;
  }
  if ((sleepHours !== null && sleepHours >= 6.5 && sleepHours < 8) || screenHours >= 1.5) {
    return adviceBank.moderate;
  }
  return adviceBank.adequateLow;
}

function formatHours(num) {
  return Number.isFinite(num) ? `${num.toFixed(1)}h` : "--";
}

function initCalculator() {
  if (!sleepForm || !ratingEl || !summaryEl) return;
  sleepForm.addEventListener("submit", evt => {
    evt.preventDefault();
    if (calcError) calcError.textContent = "";
    const bed = toMinutes(bedtimeInput.value);
    const wake = toMinutes(wakeInput.value);
    const sleepHours = hoursBetween(bed, wake);
    if (sleepHours === null || sleepHours <= 0.25 || sleepHours > 14) {
      if (calcError) calcError.textContent = "Enter realistic bed and wake times (same night to next morning).";
      setBar(sleepBar, 0);
      setBar(screenBar, 0);
      return;
    }
    const screenHours = Math.max(0, Math.min(parseFloat(screenHoursInput.value || "0"), 12));
    const cutoffMinutes = toMinutes(screenCutoffInput.value);
    const gapHours = shortestGapHours(bed, cutoffMinutes);

    const rating = deriveRating(sleepHours, screenHours, gapHours);
    ratingEl.textContent = rating.label;
    ratingEl.classList.remove("good", "ok", "poor");
    ratingEl.classList.add(rating.className);
    ratingCopy.textContent = `${rating.copy} Estimated sleep: ${sleepHours.toFixed(1)}h.`;

    const screenNote = screenHours === 0 ? "no screen time logged" : (gapHours === null ? "screens end at bedtime" : `screens end ~${gapHours.toFixed(1)}h before bed`);
    summaryEl.textContent = `Sleep window: ${sleepHours.toFixed(1)}h (bed ${bedtimeInput.value || "--"} to ${wakeInput.value || "--"}). Screens: ${screenHours.toFixed(1)}h, ${screenNote}.`;

    const advice = pickAdvice(sleepHours, screenHours, gapHours);
    adviceEl.textContent = advice;

    setBar(sleepBar, Math.min(sleepHours / 10, 1) * 100);
    sleepMeta.textContent = formatHours(sleepHours);

    const screenPressure = screenHours === 0 ? 0 : Math.min(screenHours / 3, 1);
    const gapScore = gapHours === null ? 1 : Math.max(0, 1 - gapHours / 1.5);
    const overlapScore = screenHours === 0 ? 0 : Math.min(1, screenPressure * 0.6 + gapScore * 0.4);
    setBar(screenBar, overlapScore * 100);
    screenMeta.textContent = screenHours === 0 ? "No screen time logged" : (gapHours === null ? "Screens end at bedtime" : `Screens end ~${gapHours.toFixed(1)}h before bed`);

    updateMetricsFromCalculator(sleepHours, screenHours, gapHours);
  });
}

function fillProgressBars() {
  document.querySelectorAll(".progress-bar span").forEach(span => {
    const target = Number(span.dataset.fill || "0");
    requestAnimationFrame(() => {
      span.style.width = `${Math.max(0, Math.min(target, 100))}%`;
    });
  });
}

// Shared metrics state for chart + progress bars
const metricsState = {
  sleep: 7.5,
  target: 9,
  screens: 2.5,
  winddown: 0.6,
};

function updateMetricsFromCalculator(sleepHours, screenHours, gapHours) {
  metricsState.sleep = sleepHours;
  metricsState.screens = screenHours;
  metricsState.winddown = gapHours === null ? 0 : Math.max(0, Math.min(gapHours, 2));
  drawMetricsChart();
  updateMetricBars();
}

function updateMetricBars() {
  const sleepFill = Math.min(metricsState.sleep / 10, 1) * 100;
  const screenFill = Math.min(metricsState.winddown / 1.5, 1) * 100;
  const consistencyFill = 80; // placeholder consistency
  const rows = document.querySelectorAll(".progress-bar span");
  if (rows[0]) rows[0].style.width = `${sleepFill}%`;
  if (rows[1]) rows[1].style.width = `${screenFill}%`;
  if (rows[2]) rows[2].style.width = `${consistencyFill}%`;
}

function initGsap() {
  if (typeof gsap === "undefined") return;
  gsap.registerPlugin(ScrollTrigger);

  // Hero subtle float for orb and hills
  gsap.to(".orb", {
    yPercent: -6,
    duration: 6,
    repeat: -1,
    yoyo: true,
    ease: "sine.inOut"
  });

  gsap.utils.toArray(".section").forEach((section, i) => {
    gsap.from(section, {
      scrollTrigger: {
        trigger: section,
        start: "top 80%",
        toggleActions: "play none none reverse",
      },
      y: 80,
      opacity: 0,
      duration: 1,
      ease: "power2.out",
      delay: i * 0.05
    });
  });

  // Photo split hover: smooth parallax
  const photoOverlay = document.querySelector(".photo-overlay");
  const photoContent = document.querySelector(".photo-content");
  if (photoOverlay && photoContent) {
    gsap.to(photoOverlay, {
      scrollTrigger: {
        trigger: photoOverlay,
        start: "top 90%",
        end: "bottom 20%",
        scrub: true,
      },
      y: -40,
    });
    gsap.to(photoContent, {
      scrollTrigger: {
        trigger: photoContent,
        start: "top 95%",
        end: "bottom 30%",
        scrub: true,
      },
      y: -20,
    });
  }

  // Pin key sections for a staged scroll
  ScrollTrigger.matchMedia({
    "(min-width: 900px)": function () {
      const pins = ["#why", "#habits", "#calculator", "#metrics"];
      pins.forEach(sel => {
        const el = document.querySelector(sel);
        if (!el) return;
        ScrollTrigger.create({
          trigger: el,
          start: "top top",
          end: "bottom+=40% top",
          pin: true,
          pinSpacing: true,
        });
      });
    }
  });
}

// Reveal on scroll
const observer = new IntersectionObserver(
  entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.2 }
);
reveals.forEach(el => observer.observe(el));

function updateProgress() {
  if (!progressBar) return;
  const scrollable = document.documentElement.scrollHeight - window.innerHeight;
  const pct = scrollable > 0 ? (window.scrollY / scrollable) * 100 : 0;
  progressBar.style.width = `${Math.max(0, Math.min(pct, 100))}%`;
}

// Parallax shift for any data-speed layer (subtle atmospheric motion).
function updateScene() {
  parallaxLayers.forEach(layer => {
    const speed = parseFloat(layer.dataset.speed || "0");
    const rect = layer.getBoundingClientRect();
    const translate = (rect.top - window.innerHeight * 0.5) * speed * -0.3;
    layer.style.transform = `translateY(${translate}px)`;
  });
  updateProgress();
}

updateScene();
window.addEventListener("scroll", updateScene, { passive: true });
window.addEventListener("resize", () => { updateScene(); drawChart(); drawMetricsChart(); });

// Wheel snap to nearest section (slide-like feel)
window.addEventListener("wheel", evt => {
  if (snapping || snapSections.length === 0) return;
  evt.preventDefault();
  const delta = evt.deltaY;
  const currentIndex = snapSections.findIndex(sec => {
    const rect = sec.getBoundingClientRect();
    return rect.top <= window.innerHeight * 0.5 && rect.bottom >= window.innerHeight * 0.5;
  });
  let targetIndex = currentIndex >= 0 ? currentIndex : 0;
  if (delta > 0 && targetIndex < snapSections.length - 1) targetIndex++;
  if (delta < 0 && targetIndex > 0) targetIndex--;
  snapping = true;
  snapSections[targetIndex].scrollIntoView({ behavior: "smooth", block: "start" });
  setTimeout(() => { snapping = false; }, 900);
}, { passive: false });

// Simple chart drawing (light, melatonin, arousal vs time)
function drawChart() {
  const canvas = document.getElementById("sleepChart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const { width } = canvas.getBoundingClientRect();
  const height = 320;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const times = [19, 20, 21, 22, 23];
  const light = [0.9, 0.6, 0.35, 0.15, 0.05];
  const melatonin = [0.1, 0.2, 0.4, 0.65, 0.9];
  const arousal = [0.9, 0.75, 0.55, 0.35, 0.2];

  const pad = { left: 60, right: 30, top: 30, bottom: 40 };
  const xScale = t => {
    const min = 19, max = 23;
    return pad.left + (t - min) / (max - min) * (width - pad.left - pad.right);
  };
  const yScale = v => pad.top + (1 - v) * (height - pad.top - pad.bottom);

  // Axes
  ctx.strokeStyle = "#d5d9e3";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad.left, pad.top);
  ctx.lineTo(pad.left, height - pad.bottom);
  ctx.lineTo(width - pad.right, height - pad.bottom);
  ctx.stroke();

  ctx.fillStyle = "#5d6477";
  ctx.font = "12px 'SF Pro Display', system-ui, sans-serif";
  ctx.fillText("Light / Melatonin / Arousal", pad.left, pad.top - 8);
  ctx.fillText("Time (19:00-23:00)", width - pad.right - 150, height - pad.bottom + 24);

  // Grid + x labels
  ctx.strokeStyle = "#e6e9f1";
  times.forEach(t => {
    const x = xScale(t);
    ctx.beginPath();
    ctx.moveTo(x, pad.top);
    ctx.lineTo(x, height - pad.bottom);
    ctx.stroke();
    ctx.fillStyle = "#5d6477";
    ctx.fillText(`${t}:00`, x - 18, height - pad.bottom + 16);
  });

  function drawLine(data, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    data.forEach((v, i) => {
      const x = xScale(times[i]);
      const y = yScale(v);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }

  drawLine(light, "#7ac6ff");        // light exposure
  drawLine(melatonin, "#9fb4ff");    // melatonin
  drawLine(arousal, "#5a7cff");      // arousal

  // Legend
  const legendY = pad.top + 8;
  const legendX = pad.left + 10;
  const legendItems = [
    { label: "Light", color: "#7ac6ff" },
    { label: "Melatonin", color: "#9fb4ff" },
    { label: "Arousal", color: "#5a7cff" },
  ];
  ctx.font = "12px 'SF Pro Display', system-ui, sans-serif";
  legendItems.forEach((item, idx) => {
    const lx = legendX + idx * 100;
    ctx.fillStyle = item.color;
    ctx.fillRect(lx, legendY, 14, 6);
    ctx.fillStyle = "#5d6477";
    ctx.fillText(item.label, lx + 20, legendY + 8);
  });
}

// Matrix dynamic flicker
function animateMatrix() {
  if (!matrixEl) return;
  const base = "SLEEP ";
  const repeated = base.repeat(60).trim();
  const chars = repeated.split("");
  const spans = chars.map(ch => {
    const s = document.createElement("span");
    s.textContent = ch;
    return s;
  });
  matrixEl.textContent = "";
  spans.forEach(s => matrixEl.appendChild(s));

  setInterval(() => {
    const count = Math.min(20, spans.length);
    for (let i = 0; i < count; i++) {
      const idx = Math.floor(Math.random() * spans.length);
      const span = spans[idx];
      span.classList.add("flip");
      span.textContent = base[Math.floor(Math.random() * (base.length - 1))];
      setTimeout(() => span.classList.remove("flip"), 420);
    }
  }, 600);
}

function animateHeroFlip() {
  if (!heroTitleEl) return;
  const text = heroTitleEl.textContent.trim();
  const chars = text.split("");
  heroTitleEl.textContent = "";
  const spans = chars.map(ch => {
    const s = document.createElement("span");
    s.textContent = ch === " " ? "\u00a0" : ch;
    return s;
  });
  spans.forEach(s => heroTitleEl.appendChild(s));

  setInterval(() => {
    const count = 3;
    for (let i = 0; i < count; i++) {
      const idx = Math.floor(Math.random() * spans.length);
      const span = spans[idx];
      span.classList.add("flip");
      setTimeout(() => span.classList.remove("flip"), 400);
    }
  }, 2400);
}

function setAudioVolumes() {
  if (audio) {
    audio.volume = 1; // snore louder
    audio.loop = true;
  }
  if (audio2) {
    audio2.volume = 0.35; // softer ASMR
    audio2.loop = true;
  }
}

function updateTopAudioButtons() {
  const snoreOn = audio && !audio.paused;
  const asmrOn = audio2 && !audio2.paused;
  if (snoreBtn) {
    snoreBtn.classList.toggle("is-on", snoreOn);
    snoreBtn.setAttribute("aria-pressed", String(snoreOn));
    const label = snoreBtn.querySelector(".toggle-label");
    if (label) label.textContent = snoreOn ? "Snore on" : "Snore off";
  }
  if (asmrBtn) {
    asmrBtn.classList.toggle("is-on", asmrOn);
    asmrBtn.setAttribute("aria-pressed", String(asmrOn));
    const label = asmrBtn.querySelector(".toggle-label");
    if (label) label.textContent = asmrOn ? "ASMR on" : "ASMR off";
  }
}

if (snoreBtn) {
  snoreBtn.addEventListener("click", async () => {
    const wantsPlay = !snoreBtn.classList.contains("is-on");
    try {
    if (wantsPlay) {
      await audio.play();
    } else {
      audio.pause();
    }
    updateTopAudioButtons();
    hideClickHint();
  } catch {
    // ignore
  }
});
}

if (asmrBtn) {
  asmrBtn.addEventListener("click", async () => {
    const wantsPlay = !asmrBtn.classList.contains("is-on");
    try {
    if (wantsPlay) {
      await audio2.play();
    } else {
      audio2.pause();
    }
    updateTopAudioButtons();
    hideClickHint();
  } catch {
    // ignore
  }
});
}

// Column chart for metrics section
function drawMetricsChart() {
  const canvas = document.getElementById("metricsChart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const { width } = canvas.getBoundingClientRect();
  const height = 260;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const labels = ["Sleep", "Target", "Screens", "Wind-down"];
  const values = [
    metricsState.sleep,
    metricsState.target,
    metricsState.screens,
    metricsState.winddown
  ];
  const colors = ["#7ac6ff", "#5a7cff", "#f7b267", "#88e0c2"];
  const maxVal = 10;

  const pad = { left: 50, right: 20, top: 24, bottom: 36 };
  const barWidth = (width - pad.left - pad.right) / labels.length * 0.6;

  ctx.strokeStyle = "#e6e9f1";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad.left, pad.top);
  ctx.lineTo(pad.left, height - pad.bottom);
  ctx.lineTo(width - pad.right, height - pad.bottom);
  ctx.stroke();

  ctx.fillStyle = "#5d6477";
  ctx.font = "12px 'SF Pro Display', system-ui, sans-serif";
  ctx.fillText("Hours / Score", pad.left, pad.top - 6);

  labels.forEach((label, i) => {
    const xCenter = pad.left + (i + 0.5) * ((width - pad.left - pad.right) / labels.length);
    const barHeight = (values[i] / maxVal) * (height - pad.top - pad.bottom);
    const x = xCenter - barWidth / 2;
    const y = height - pad.bottom - barHeight;
    ctx.fillStyle = colors[i % colors.length];
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, barWidth, barHeight, 6);
    else ctx.rect(x, y, barWidth, barHeight);
    ctx.fill();
    ctx.fillStyle = "#5d6477";
    ctx.fillText(label, xCenter - ctx.measureText(label).width / 2, height - pad.bottom + 16);
    ctx.fillText(values[i].toFixed(1), xCenter - 10, y - 6);
  });
}

function hideClickHint() {
  if (clickHint) clickHint.classList.add("hide");
}
