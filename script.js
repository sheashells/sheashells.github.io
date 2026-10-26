const SUPABASE_URL = "https://qrltlwpqpmpsuqzgsenh.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_Rz129-kFDya8nJ6BOIlBIg_ZeoWf7sx";

const { createClient } = window.supabase;
const db = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const authScreen = document.getElementById("auth-screen");
const chatScreen = document.getElementById("chat-screen");
const authForm = document.getElementById("auth-form");
const showLoginBtn = document.getElementById("show-login");
const showSignupBtn = document.getElementById("show-signup");
const displayNameInput = document.getElementById("display-name");
const displayNameLabel = document.getElementById("display-name-label");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const authSubmit = document.getElementById("auth-submit");
const authError = document.getElementById("auth-error");
const logoutBtn = document.getElementById("logout-btn");
const accountLabel = document.getElementById("account-label");
const statusEl = document.getElementById("connection-status");
const messagesEl = document.getElementById("messages");
const messageCountEl = document.getElementById("message-count");
const messageForm = document.getElementById("message-form");
const messageInput = document.getElementById("message-input");

let authMode = "login";
let currentUser = null;
let currentProfile = null;
let messages = [];
let realtimeChannel = null;
let weatherRequestNumber = 0;

function setStatus(message, state = "") {
  statusEl.textContent = message;
  statusEl.className = "status " + state;
}
function setAuthMode(mode) {
  authMode = mode;
  const signup = mode === "signup";
  showLoginBtn.classList.toggle("active", !signup);
  showSignupBtn.classList.toggle("active", signup);
  displayNameInput.hidden = !signup;
  displayNameLabel.hidden = !signup;
  displayNameInput.required = signup;
  authSubmit.textContent = signup ? "Create account" : "Log in";
  passwordInput.autocomplete = signup ? "new-password" : "current-password";
  authError.textContent = "";
}
showLoginBtn.addEventListener("click", () => setAuthMode("login"));
showSignupBtn.addEventListener("click", () => setAuthMode("signup"));

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  authError.textContent = "";
  authSubmit.disabled = true;
  authSubmit.textContent = authMode === "signup" ? "Creating account…" : "Logging in…";
  try {
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    if (authMode === "signup") {
      const displayName = displayNameInput.value.trim();
      if (displayName.length < 2 || displayName.length > 24) {
        throw new Error("Display name must be 2–24 characters.");
      }
      const { error } = await db.auth.signUp({
        email,
        password,
        options: { data: { display_name: displayName } }
      });
      if (error) throw error;
      authError.className = "notice";
      authError.textContent = "Account created. If email confirmation is enabled, confirm your email before logging in.";
      setAuthMode("login");
    } else {
      const { error } = await db.auth.signInWithPassword({ email, password });
      if (error) throw error;
    }
  } catch (error) {
    authError.className = "notice error";
    authError.textContent = error.message || "Authentication failed.";
  } finally {
    authSubmit.disabled = false;
    authSubmit.textContent = authMode === "signup" ? "Create account" : "Log in";
  }
});

logoutBtn.addEventListener("click", async () => {
  const { error } = await db.auth.signOut();
  if (error) setStatus("Could not log out: " + error.message, "offline");
});

db.auth.onAuthStateChange((_event, session) => {
  // Defer database work out of the auth callback to avoid locking the auth client.
  setTimeout(() => {
    if (session?.user) enterChat(session.user);
    else leaveChat();
  }, 0);
});

async function enterChat(user) {
  if (currentUser?.id === user.id && !chatScreen.hidden) return;
  currentUser = user;
  authScreen.hidden = true;
  chatScreen.hidden = false;
  accountLabel.textContent = user.email || "Signed in";
  setStatus("Loading your profile…");
  try {
    const { data: profile, error } = await db
      .from("profiles")
      .select("id, display_name")
      .eq("id", user.id)
      .single();
    if (error) throw error;
    currentProfile = profile;
    accountLabel.textContent = `${profile.display_name} • ${user.email}`;
    await loadMessages();
    subscribeToMessages();
    setStatus("Connected • live updates enabled", "online");
  } catch (error) {
    console.error(error);
    setStatus("Could not load chat. Check the SQL setup and Supabase policies.", "offline");
    addLocalSystemMessage("Setup error: " + error.message);
  }
}

async function leaveChat() {
  currentUser = null;
  currentProfile = null;
  messages = [];
  if (realtimeChannel) {
    await db.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }
  authScreen.hidden = false;
  chatScreen.hidden = true;
  authError.textContent = "";
  renderMessages();
}

function formatTime(value) {
  return new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
function renderMessages() {
  messagesEl.replaceChildren();
  messageCountEl.textContent = `${messages.length} message${messages.length === 1 ? "" : "s"}`;
  if (!messages.length) {
    const empty = document.createElement("li");
    empty.className = "empty";
    empty.textContent = "No messages yet. Send the first message.";
    messagesEl.appendChild(empty);
    return;
  }
  for (const msg of messages) {
    const item = document.createElement("li");
    const mine = msg.user_id === currentUser?.id;
    item.className = "message" + (mine ? " mine" : "");
    const author = document.createElement("span");
    author.className = "author";
    author.textContent = mine ? "You" : (msg.display_name || "Classmate");
    const text = document.createElement("p");
    text.textContent = msg.content;
    const time = document.createElement("time");
    time.dateTime = msg.created_at;
    time.textContent = formatTime(msg.created_at);
    item.append(author, text, time);
    messagesEl.appendChild(item);
  }
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

async function loadMessages() {
  const { data, error } = await db
    .from("messages")
    .select("id, user_id, content, created_at, profiles(display_name)")
    .order("created_at", { ascending: true })
    .limit(50);
  if (error) throw error;
  messages = (data || []).map((row) => ({
    ...row,
    display_name: row.profiles?.display_name || "Classmate"
  }));
  renderMessages();
}

function subscribeToMessages() {
  if (realtimeChannel) db.removeChannel(realtimeChannel);
  realtimeChannel = db.channel("class-chat-messages")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, async (payload) => {
      if (messages.some((m) => m.id === payload.new.id)) return;
      const { data: profile } = await db.from("profiles").select("display_name").eq("id", payload.new.user_id).maybeSingle();
      messages.push({ ...payload.new, display_name: profile?.display_name || "Classmate" });
      messages = messages.slice(-50);
      renderMessages();
    })
    .on("postgres_changes", { event: "DELETE", schema: "public", table: "messages" }, (payload) => {
      messages = messages.filter((m) => m.id !== payload.old.id);
      renderMessages();
    })
    .subscribe((state) => {
      if (state === "SUBSCRIBED") setStatus("Connected • live updates enabled", "online");
      if (state === "CHANNEL_ERROR" || state === "TIMED_OUT") setStatus("Live connection failed. Refresh and check Realtime settings.", "offline");
    });
}

function addLocalSystemMessage(content) {
  const item = document.createElement("li");
  item.className = "message bot";
  const author = document.createElement("span");
  author.className = "author";
  author.textContent = "System";
  const text = document.createElement("p");
  text.textContent = content;
  item.append(author, text);
  messagesEl.appendChild(item);
}

messageForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!currentUser) return;
  const content = messageInput.value.trim();
  if (!content) return;
  messageInput.value = "";
  messageInput.focus();

  // The weather command is local/private and is not inserted into the shared database.
  if (/^\/weather(?:\s|$)/i.test(content)) {
    await handleWeatherCommand(content);
    return;
  }

  const { error } = await db.from("messages").insert({ content });
  if (error) {
    console.error(error);
    addLocalSystemMessage("Message was not sent: " + error.message);
  }
});

function describeWeather(code) {
  if (code === 0) return "clear sky";
  if (code <= 3) return "partly cloudy";
  if (code <= 48) return "foggy";
  if (code <= 57) return "drizzle";
  if (code <= 67) return "rain";
  if (code <= 77) return "snow";
  if (code <= 82) return "rain showers";
  if (code <= 86) return "snow showers";
  return "thunderstorm";
}
async function getWeather(city) {
  const geoUrl = "https://geocoding-api.open-meteo.com/v1/search?name=" +
    encodeURIComponent(city) + "&count=1&language=en&format=json";
  const geoResponse = await fetch(geoUrl);
  if (!geoResponse.ok) throw new Error("Location search failed.");
  const geoData = await geoResponse.json();
  if (!geoData.results?.length) return `Sorry, I could not find a place named ${city}.`;
  const place = geoData.results[0];
  const url = "https://api.open-meteo.com/v1/forecast?latitude=" + place.latitude +
    "&longitude=" + place.longitude + "&current=temperature_2m,weather_code,wind_speed_10m";
  const response = await fetch(url);
  if (!response.ok) throw new Error("Weather service is unavailable.");
  const data = await response.json();
  const now = data.current;
  return `${place.name}, ${place.country}: ${now.temperature_2m}°C, ${describeWeather(now.weather_code)}, wind ${now.wind_speed_10m} km/h.`;
}
async function handleWeatherCommand(command) {
  const city = command.replace(/^\/weather/i, "").trim();
  let reply;
  if (!city) reply = "Try it like this: /weather Manila";
  else {
    const request = ++weatherRequestNumber;
    addLocalSystemMessage("WeatherBot is checking the weather…");
    const lastItem = messagesEl.lastElementChild;
    try {
      reply = await getWeather(city);
    } catch (error) {
      console.error(error);
      reply = "Sorry, the weather service is not answering right now.";
    }
    if (request === weatherRequestNumber && lastItem?.isConnected) lastItem.remove();
  }
  addLocalSystemMessage("WeatherBot: " + reply);
}

// Initial session check covers refreshes where the user is already logged in.
(async () => {
  const { data, error } = await db.auth.getSession();
  if (error) {
    authError.textContent = error.message;
    return;
  }
  if (data.session?.user) await enterChat(data.session.user);
  else setAuthMode("login");
})();