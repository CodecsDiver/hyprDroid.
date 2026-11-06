# Publishing and updating on Netlify

The site needs no build. The folder you publish is this one (the folder that contains `index.html` and `netlify.toml`).

Nothing has been published from here. The Netlify site and account connection have not been supplied, so choose the intended site deliberately. Do not publish into a different project.

## First publish to Dan's existing Netlify site

Option A: drag and drop
1. In Netlify, open the intended site, then Deploys.
2. Drag this folder (`shawn-tanner-studio`) onto the deploy drop area.
3. Open the site link and check the welcome tour appears.

Option B: Netlify command line
```
npm install -g netlify-cli
cd shawn-tanner-studio
netlify login
netlify link          # choose the intended existing site
netlify deploy --prod --dir=.
```

Option C: connect the Git repository
Set the base directory to `shawn-tanner-studio`, leave the build command empty and the publish directory as `.`.

## Updating at the same link

Publish again to the same site. The link does not change. Pages are served with `no-cache`, so Shawn sees the new version on his next visit. His notes stay in his browser and are not touched by an update. Notes on parts that changed are flagged for a second look instead of being lost.

## After publishing: quick check

1. Open the link on a computer and on a phone.
2. Run the walkthrough, switch designs, open a page in each, leave a note, and download both files.
3. Use Help then "What is real and what is pretend" to confirm the demo notice.

## Notes

- The pages ask Google Fonts for typefaces. If the fonts cannot load, readable fallback fonts are used.
- The studio is marked `noindex` so search engines are asked to skip it. This is not a password. Anyone with the link can open it, and no one can see another person's notes.
