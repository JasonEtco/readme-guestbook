function showSection () {
  const loggedIn = document.querySelector('.js-logged-in')
  const loggedOut = document.querySelector('.js-logged-out')
  const user = firebase.auth().currentUser

  if (user) {
    loggedIn.style.display = 'block'
    loggedOut.style.display = 'none'
  } else {
    loggedIn.style.display = 'none'
    loggedOut.style.display = 'block'
  }
}

async function getUser (token) {
  const result = await fetch('https://api.github.com/user', {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `token ${token}`,
      'User-Agent': 'readme-guestbook'
    }
  })

  const json = await result.json()
  return json
}

function updateUserUI (user) {
  const img = document.querySelector('.js-user-img')
  img.src = user.avatar_url
  img.alt = `@${user.login}`
  document.querySelector('.js-form input[name="name"]').value = user.login
}

const provider = new firebase.auth.GithubAuthProvider()

firebase.initializeApp({
  apiKey: 'AIzaSyDe1vUuREtEZu6OVWAzL7_iIxiFRBBbas8',
  authDomain: 'readme-guestbook.firebaseapp.com',
  projectId: 'readme-guestbook'
})

const loginBtn = document.querySelector('.js-login-btn')
loginBtn.addEventListener('click', async () => {
  const { credential } = await firebase.auth().signInWithPopup(provider)
  const user = await getUser(credential.accessToken)
  updateUserUI(user)
  showSection()
})

/**
 * 
 * @param {HTMLElement} message 
 */
function toggleMessageTextarea (message) {
  if (message.hasAttribute('disabled')) {
    message.removeAttribute('disabled')
  } else {
    message.setAttribute('disabled', 'true')
  }
  message.classList.toggle('bg-gray-200')
}

const form = document.querySelector('.js-form')
form.addEventListener('submit', async evt => {
  evt.preventDefault()
  const submitBtn = form.querySelector('.js-submit-btn')
  const loadingBtn = form.querySelector('.js-submit-btn-loading')
  const doneBtn = form.querySelector('.js-submit-btn-done')

  submitBtn.style.display = 'none'
  submitBtn.setAttribute('disabled', 'true')
  loadingBtn.style.display = 'inline-block'
 
  const name = form.querySelector('input[name="name"]').value
  const message = form.querySelector('textarea[name="message"]')

  const res = await window.fetch('/api/submit-form', {
    method: 'POST',
    body: JSON.stringify({
      name,
      message: message.value
    }),
    headers: {
      'Content-Type': 'application/json'
    }
  })

  toggleMessageTextarea(message)
  loadingBtn.style.display = 'none'

  if (res.ok) {
    const { error, redirect } = await res.json()

    if (error) {
      window.alert(error)
      submitBtn.style.display = 'inline-block'
      submitBtn.removeAttribute('disabled')
      toggleMessageTextarea(message)
    } else {
      loadingBtn.style.display = 'none'
      doneBtn.style.display = 'inline-block'
      window.location.replace(redirect)
    }
  }
})
