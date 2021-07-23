<h3 align="center">README Guestbook</h3>
<p align="center">A little web app that transforms a README into a guestbook.</p>
<p align="center"><a href="https://readme-guestbook.vercel.app">Let me know that you stopped by!</a></p>

## How it works

When someone visits `readme-guestbook.vercel.app`, they're asked to login. This is so that we can sign their entry! Next, they submit a form, which hits [the form handler](/api/submit-form.ts).

Next, we call this API to fetch the contents of the README:

```
GET /repos/:owner/:repo/readme
```

Once we have the content, we parse it to look for special tags:

```md

<!--START_SECTION:guestbook-->
...
<!--END_SECTION:guestbook-->
<!--GUESTBOOK_LIST []-->
```

`GUESTBOOK_LIST` is a JSON array of `{ name, message, date }`. We store those objects directly in the README. When a new entry comes in, we read that existing list, add our new entry to it, then replace everything between the `START_SECTION` and `END_SECTION` tags with a freshly rendered list from a template. That brings us to calling this API to update the file contents of the README:

```
PUT /repos/:owner/:repo/contents/:path
```

Some values are hard-coded - I'm not yet sure of the best way to allow others to use this service! Feel free to [open an issue](https://github.com/JasonEtco/readme-guestbook/issues/new) if you have thoughts 🙏
