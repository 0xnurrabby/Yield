<img src="https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=2,8,15&height=180&section=header&text=Yield+Vats&fontSize=52&fontColor=000000&fontAlignY=38&desc=DeFi+yield+vat+simulation+as+a+Farcaster+mini+app+on+Base&descAlignY=58&descSize=14&animation=fadeIn" width="100%"/>

<div align="center">

[![Live](https://img.shields.io/badge/Live%20App-bbf7d0?style=for-the-badge&logoColor=000)](https://yield-vats.vercel.app)
[![License](https://img.shields.io/badge/MIT-bfdbfe?style=for-the-badge&logoColor=000)](LICENSE)
[![Platform](https://img.shields.io/badge/Farcaster%20Mini%20App-fde68a?style=for-the-badge&logoColor=000)]()
[![Tech](https://img.shields.io/badge/JavaScript%20%2B%20Base-fca5a5?style=for-the-badge&logoColor=000)]()

</div>

<div align="center">
<i>A DeFi-themed Farcaster mini app where you manage yield vats on Base .... deposit, watch yields accumulate, and interact with on-chain mechanics.</i>
</div>

---

## ✦ Features

<div align="center">

| | Feature | What it does |
|:---:|---|---|
| 🏺 | Yield vats | Deposit into vats and watch yield accumulate over time |
| ⛓️ | Base Mainnet | All interactions go through Base chain |
| 📱 | Farcaster native | Runs inside Warpcast / Base app as a mini app |
| 🔗 | Wallet connect | Connect Base wallet to interact with vats |
| 💰 | USDC tip | Built-in tip flow on Base |

</div>

---

## ✦ Download & Run

**Step 1** .... Clone the repo

```bash
git clone https://github.com/0xnurrabby/Yield
cd Yield
```

**Step 2** .... Serve the public folder

```bash
cd public
start index.html

# Or use a local server
npx serve public
# Open http://localhost:3000
```

**Step 3** .... Connect wallet and interact with yield vats

---

## ✦ Setup

```
1. Clone the repo
2. Navigate to the public/ folder
3. Open index.html in a browser
4. For wallet connect and on-chain interactions:
   open inside Warpcast or Base app (requires Farcaster client)
5. To deploy: push to Vercel
   Set the root directory to public/ in Vercel settings
   or deploy the public/ folder directly
```

---

## ✦ Project Structure

```
Yield/
  public/
    index.html    ->  entry point with Farcaster mini app meta
    app.js        ->  vat logic, wallet connect, Base interactions, USDC tip
    styles.css    ->  DeFi-themed UI styles
    assets/       ->  icons, splash, embed images
    .well-known/  ->  Farcaster app manifest
    README.md     ->  notes
```

---

<img src="https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=2,8,15&height=100&section=footer&animation=fadeIn" width="100%"/>

<div align="center">MIT License .... built by <a href="https://github.com/0xnurrabby">0xnurrabby</a></div>
