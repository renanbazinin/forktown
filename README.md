# Forktown 🌱

**A little town, built one pull request at a time.** Design a home and a neighbor; contribute one JSON file. Every house hangs a lantern on the Lantern Fork.

[Visit the town](https://renanbazinin.github.io/forktown/) · [Detailed contributor guide](CONTRIBUTING.md)

<img src="public/og-image.png" alt="Forktown on an autumn evening: houses around the Lantern Fork, a football match at the Meadow Ground and a concert at the Little Stage." width="800">

## 1. Start in the live town

Open the [live site](https://renanbazinin.github.io/forktown/) and click **Find your way in**. You’ll see **Pick an open plot** and **Fork on GitHub**:

<img src="docs/images/contribute-live.jpg" alt="Live site: Make yourself at home shows the three contribution steps and a Fork on GitHub button." width="640">

**Why can’t I build here?** The published town saves nothing, so there are two ways in:

- **Quick, in your browser.** Choose **Pick an open plot**, or select an open plot on the map. Type your GitHub username and choose **Create my house file on GitHub**: GitHub opens a new file in `places/` with a whole house filled in. Write your own story, change what you like, propose the file and open your pull request. No install needed; [step by step](CONTRIBUTING.md#start-in-your-browser). To design every detail first, choose **Or design every detail in the builder** under that button.
- **In your own copy.** Fork the town and run it on your computer, as below. The builder saves your house straight into your project, and you learn the whole workflow: clone, branch, commit, push.

Either way, a merged pull request brings your house to the shared town.

## 2. Fork it and run it locally

You’ll need a GitHub account, Git, and Node.js 24 (22.12+ also works). No API keys or database setup.

Click [Fork on GitHub](https://github.com/renanbazinin/forktown/fork), then **Create fork**. In a terminal, replace `YOUR_USERNAME` below with your GitHub username and paste:

```sh
git clone https://github.com/YOUR_USERNAME/forktown.git
cd forktown
git switch -c add-my-place
npm ci
npm run dev
```

Leave that terminal running. Open [localhost:5173](http://localhost:5173) and click **Find your way in**. Now the button says **Build a place**:

<img src="docs/images/contribute-local.jpg" alt="Localhost: the same welcome dialog now offers Build a place." width="640">

> Still seeing **Fork on GitHub**? Check that you opened localhost and started `npm run dev`. The live site and `npm run preview` can't save into your project, so they don't offer **Build a place**.

## 3. Make it yours

Click **Build a place**. Enter your real GitHub username, then customize **Home**, **Neighbor**, and **Outdoor sign**. Scroll down to choose an open plot, add a story, and check your **File id**.

<img src="docs/images/contribute-builder.jpg" alt="Local builder: Willow Lodge preview beside the Home, Neighbor, and Outdoor sign tabs, username field, house styles, and colors." width="800">

Names and plots in these screenshots are examples. **One new house + one neighbor per pull request.** Choosing a plot does not reserve it.

## 4. Save your house

Choose **Continue to save**, then **Save to my project** (scroll down if needed).

<img src="docs/images/contribute-save.jpg" alt="Save screen: the house JSON and Save to my project button, with instructions to commit the new file and open a pull request." width="800">

This creates `places/YOUR_FILE_ID.json` and adds the house to your local town. Click **See my saved JSON** to review it, or **See my place in town** to visit. Saving locally does not publish it.

## 5. Send your pull request

Open a second terminal in your `forktown` folder and check your house:

```sh
npm run validate
```

It takes a couple of seconds and names the exact file and field to fix. Changed the town’s code too? Run `npm run check` instead, which also runs the tests and the build.

Once it passes, replace `YOUR_FILE_ID` with the file id from the builder and run:

```sh
git add places/YOUR_FILE_ID.json
git --no-pager diff --cached
git commit -m "Add my place to Forktown"
npm run check:pr -- origin/main HEAD
git push -u origin add-my-place
```

`npm run check:pr` makes sure your branch adds just one house.

On your GitHub fork, click **Compare & pull request**. Target **renanbazinin/forktown → main**, check that only your new house file is included, complete the checklist, and click **Create pull request**.

After checks, merge, and deployment, your house appears in the [live town](https://renanbazinin.github.io/forktown/). Your first house merges automatically once every check passes, if the PR changes nothing else; anything else waits for a maintainer’s review. If changes are requested, commit and push them on the same branch to update that pull request.

Once you’ve moved in, select your house and click **Share**. The link opens a page of its own, `house/YOUR_FILE_ID/`, so it shows your house’s name and story wherever you post it.

## About Forktown

Forktown makes a first open-source contribution something you can visit. Each contributed house brings a neighbor, a story, and its creator’s credit into a shared pixel town.

The town has a life of its own: neighbors take walks, meet at concerts, watch films, and stop by football matches. A full day and night lasts 24 real minutes, and each season about 11 hours: blossom, fireflies, turning leaves, then snow. Explore at your own pace, follow a resident, or enjoy the [live view](https://renanbazinin.github.io/forktown/).

Want to help beyond building a house? Pick up an open [good first issue](https://github.com/renanbazinin/forktown/issues?q=is%3Aissue%20is%3Aopen%20label%3A%22good%20first%20issue%22) or one marked [help wanted](https://github.com/renanbazinin/forktown/issues?q=is%3Aissue%20is%3Aopen%20label%3A%22help%20wanted%22), improve the guides, report a bug, or contribute to the town itself. The [project guide](docs/PROJECT_GUIDE.md) covers features, code structure, and development commands.

---

[JSON fields & contribution rules](CONTRIBUTING.md) · [Features, project map & commands](docs/PROJECT_GUIDE.md) · [Architecture](docs/ARCHITECTURE.md) · [Publishing](docs/PUBLISHING.md) · [Live view](docs/LIVE.md) · [Roadmap](docs/ROADMAP.md)

[Code of conduct](CODE_OF_CONDUCT.md) · [Security](SECURITY.md) · [MIT license](LICENSE)
