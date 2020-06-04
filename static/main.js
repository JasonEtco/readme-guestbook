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

const form = document.querySelector('.js-form')
form.addEventListener('submit', async evt => {
  evt.preventDefault()
  const message = form.querySelector('textarea[name="message"]').value

  const res = await window.fetch('/api/submit-form', {
    method: 'POST',
    body: JSON.stringify({
      name: firebase.auth().currentUser.login,
      message
    }),
    headers: {
      'Content-Type': 'application/json'
    }
  })

  if (res.ok) {
    const { error, redirect } = await res.json()

    if (error) {
      window.alert(error)
    } else {
      window.location.replace(redirect)
    }
  }
})
