(function () {

  // ------------------------------------------------------------------
  // 1) PASTE YOUR SUPABASE PROJECT DETAILS HERE
  //    (Project Settings -> API in your Supabase dashboard)
  // ------------------------------------------------------------------
  const SUPABASE_URL = "https://epwjievvtjvdhdxzfjui.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVwd2ppZXZ2dGp2ZGhkeHpmanVpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ4NTg0NjIsImV4cCI6MjEwMDQzNDQ2Mn0.YL_iJjhcarQso-DGCuLjQVC0zNYZrLnEZ-9gNcuqVI8";
  // ------------------------------------------------------------------

  const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const overlay = document.getElementById('tk-auth-overlay');
  const appEl = document.getElementById('tk-app');
  const userBar = document.getElementById('tk-user-bar');
  const userEmailEl = document.getElementById('tk-user-email');

  const form = document.getElementById('tk-auth-form');
  const emailInput = document.getElementById('tk-auth-email');
  const passInput = document.getElementById('tk-auth-password');
  const errorEl = document.getElementById('tk-auth-error');
  const submitBtn = document.getElementById('tk-auth-submit');
  const toggleBtn = document.getElementById('tk-auth-toggle');
  const titleEl = document.getElementById('tk-auth-title');
  const logoutBtn = document.getElementById('tk-logout-btn');

  let mode = 'signin';
  let appLoaded = false;

  function setMode(next) {
    mode = next;
    errorEl.style.display = 'none';
    if (mode === 'signin') {
      titleEl.textContent = 'Log in to Tikrar';
      submitBtn.textContent = 'Log in';
      toggleBtn.textContent = 'New here? Create an account';
      passInput.setAttribute('autocomplete', 'current-password');
    } else {
      titleEl.textContent = 'Create your Tikrar account';
      submitBtn.textContent = 'Sign up';
      toggleBtn.textContent = 'Already have an account? Log in';
      passInput.setAttribute('autocomplete', 'new-password');
    }
  }
  toggleBtn.addEventListener('click', () => setMode(mode === 'signin' ? 'signup' : 'signin'));

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    errorEl.style.display = 'none';
    submitBtn.disabled = true;
    const email = emailInput.value.trim();
    const password = passInput.value;
    try {
      if (mode === 'signin') {
        const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { data, error } = await supabaseClient.auth.signUp({ email, password });
        if (error) throw error;
        if (!data.session) {
          errorEl.textContent = 'Account created. Check your email to confirm it, then log in.';
          errorEl.style.display = 'block';
          setMode('signin');
        }
      }
    } catch (e) {
      errorEl.textContent = e.message || 'Something went wrong.';
      errorEl.style.display = 'block';
    }
    submitBtn.disabled = false;
  });

  logoutBtn.addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    location.reload();
  });

  const saveStatusEl = document.getElementById('tk-save-status');
  let saveStatusTimer = null;
  function setSaveStatus(state) {
    if (!saveStatusEl) return;
    clearTimeout(saveStatusTimer);
    saveStatusEl.classList.remove('ok', 'saving', 'error');
    if (state === 'saving') {
      saveStatusEl.textContent = 'Saving…';
      saveStatusEl.classList.add('saving');
    } else if (state === 'ok') {
      saveStatusEl.textContent = 'Saved';
      saveStatusEl.classList.add('ok');
      saveStatusTimer = setTimeout(() => { saveStatusEl.textContent = ''; }, 2000);
    } else if (state === 'error') {
      saveStatusEl.textContent = '⚠ Not saved — check your connection';
      saveStatusEl.classList.add('error');
    }
  }

  async function getWithRetry(key, attempts) {
    let lastErr;
    for (let i = 0; i < attempts; i++) {
      try {
        const { data, error } = await supabaseClient
          .from('tikrar_kv')
          .select('value')
          .eq('key', key)
          .maybeSingle();
        if (error) throw error;
        return { value: data ? data.value : null };
      } catch (e) {
        lastErr = e;
        if (i < attempts - 1) await new Promise(r => setTimeout(r, 500));
      }
    }
    throw lastErr;
  }

  function setupStorage() {
    window.storage = {
      get: (key) => getWithRetry(key, 3),
      set: async (key, value) => {
        setSaveStatus('saving');
        try {
          const { data: userData, error: userErr } = await supabaseClient.auth.getUser();
          if (userErr || !userData.user) throw userErr || new Error('Not signed in');
          const { error } = await supabaseClient
            .from('tikrar_kv')
            .upsert(
              { user_id: userData.user.id, key, value, updated_at: new Date().toISOString() },
              { onConflict: 'user_id,key' }
            );
          if (error) throw error;
          setSaveStatus('ok');
        } catch (e) {
          setSaveStatus('error');
          throw e;
        }
      }
    };
  }

  function showApp(user) {
    overlay.style.display = 'none';
    appEl.style.display = '';
    userBar.style.display = 'flex';
    userEmailEl.textContent = user.email;
    if (!appLoaded) {
      appLoaded = true;
      setupStorage();
      const s = document.createElement('script');
      s.src = 'app.js';
      document.body.appendChild(s);
    }
  }

  function showLogin() {
    overlay.style.display = 'flex';
    appEl.style.display = 'none';
    userBar.style.display = 'none';
  }

  supabaseClient.auth.onAuthStateChange((_event, session) => {
    if (session && session.user) {
      showApp(session.user);
    } else {
      showLogin();
    }
  });

  supabaseClient.auth.getSession().then(({ data }) => {
    if (data.session && data.session.user) {
      showApp(data.session.user);
    } else {
      showLogin();
    }
  });

})();
