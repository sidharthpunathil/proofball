# ProofBall

Momentum trading for your favorite sports. Call which way a live match is about to swing, then prove you called it, in beta on Solana devnet.

---

## Abstract

ProofBall is a free game you play while watching football. During a live match, a number on the screen shows each team's win-probability: the chance they win right now, say 42%. That number moves with every chance, save, and goal. ProofBall lets you call which way it is about to swing, then proves you called it.

Here is the honest part. The moment you lock a pick, ProofBall takes a fingerprint of it and writes that to Solana, a public ledger anyone can read. The fingerprint is a hash, a short code that stands in for your exact pick and the time. This happens before the number moves. When the match settles, the timestamp shows you called it early, and the result is checked against match data written to that same public ledger. So the game cannot quietly swap your pick or fudge the outcome after the fact. You do not have to trust us. You can click a link and check it yourself.

The probability itself is real, not a guess. It comes from a live betting feed called TxLINE, with the bookmaker's profit cut stripped out. That stripped number is called de-margined odds: the raw implied chance with the house's built-in margin removed. So the needle you are reading sits close to the true probability, not a price set to earn someone money off you.

One thing we say plainly. ProofBall is in beta, running on Solana devnet, which is Solana's free test network. You play with $PROOF, a real token that lands in your own wallet, but on devnet it has no cash value, so nothing real is at stake today. Real stakes, on Solana mainnet, are on the roadmap. When that day comes, it will follow the rules that real money brings.

The running example in this paper is the Spain versus Argentina final. You call Spain to stay above 42%. We record it before the needle moves. When the match ends, you can see, and verify, whether you were right. Our demo runs on 30 finished knockout matches with their real scorelines, and it tells you so on screen. You are playing a replay, not a live game.

## The problem

Here is the deal every fan is offered today. Two bad choices, and neither is what fans actually want.

**Choice one: bet real money, priced for the house.** When you place a bet, the odds already have the bookmaker's profit built in. Say the final is a true coin flip, 50/50. A fair bet would pay back $2 for every $1 on the winner. The bookmaker pays $1.90 instead. That missing 10 cents is its margin, a guaranteed cut sometimes called the vig. It hides inside the odds, so most people never notice it. Bet all season and it quietly eats your money.

It is not cheating. It is math the house set in its own favor, and you cannot opt out. The game was tilted before kickoff, and the house collects whether you win or lose.

Then there is the part nobody mentions. You trust the operator for everything. It records your pick. It records the score. It decides if you won. All of it lives in a private database you never see. If a number moved after the final whistle, you would have no way to know. When the app says you lost, you take its word.

**Choice two: tap a free poll that forgets you.** Your score app asks "Who will win?" and you tap Spain. Nothing is saved, nothing is at stake, and by full time no one remembers you called it. Being right gets you nothing, not even bragging rights you can prove.

What fans actually want is smaller than either choice:

- To call the match live, as it swings, instead of a bet frozen before kickoff.
- Proof they called it, something they can show a friend later.
- Fairness they can check themselves, instead of "trust us."
- To do all of it without betting real money.

No single product offers those four together. That is the gap ProofBall fills.

## How it works

ProofBall runs on the phone in your hand while the game plays on the TV. That is the second-screen idea: a companion to the broadcast, not a replacement. Most second-screen apps just show you numbers. ProofBall lets you call which way those numbers are about to move, records the call, and pays out points when you get it right.

Here is the whole loop, told through one fan. Call her Maya. She is watching the Spain versus Argentina final. On her screen sits a single needle: the live win-probability for Spain, meaning the chance Spain wins the match right now. At kickoff it reads 42%. That number is de-margined, so it is an honest read on the match, and it jumps the instant something happens on the pitch.

**Sign in.** Maya connects a Solana wallet, like Phantom, Solflare, or Backpack, with one tap. That wallet's public address is simply who she is on ProofBall. There is no username and no password sitting in a company database. Her key is her identity, and she holds it.

**Get some $PROOF.** The first time Maya connects, ProofBall mints 1,000 $PROOF straight to her wallet. That is an airdrop: free tokens handed to you, no purchase needed. $PROOF is a real token on Solana, and she can see it sitting in her wallet. Because this is the devnet test network, it has no cash value yet, so it is free to play with today. Only the first 10,000 wallets get this welcome airdrop.

**A round opens.** Every few seconds, ProofBall opens a short round on the needle. The question is always the same shape. Over the next few seconds, will Spain's needle be Rising or Falling? A small timer counts down. Maya has a moment to decide before it locks.

**Call it, and enter the pool.** Maya thinks Spain is about to press. She taps Rising and puts in a small entry, say 100 $PROOF. Her entry does not go to ProofBall. It goes into escrow: a neutral holding spot that keeps everyone's entries until the round is settled. Every other player's entry for this round lands in the same pot.

This is a parimutuel pool. That French word covers a simple idea. Everyone's entries go into one pot, the house takes a small fixed cut, and whoever called it right splits the rest, in proportion to how much each of them put in. You are playing against the other fans, not against ProofBall. ProofBall's only cut is a flat slice off the top, called the rake. Win or lose, ProofBall never takes a side.

**It locks.** When the timer hits zero, Maya's call is frozen. At that exact moment, ProofBall writes a fingerprint of it to Solana, before anyone knows how the needle moves. Later, the timestamp proves she called it early, and she can tap a verify link to check it herself.

**It settles against the real number.** A few seconds pass. Argentina loses the ball, Spain surges, and the live feed reprices. The needle ticks up to 44%. Rising was right. ProofBall does not decide this. The real de-margined feed does, the same number the industry itself trades on.

**Winners split the pot.** Say the round's pot held 1,000 $PROOF: 400 on Rising, 600 on Falling. ProofBall takes no rake, so the full 1,000 goes to the Rising backers, shared out by how much each staked. Maya put in 100 of the 400 on Rising, so she takes 1,000 × 100 / 400 = 250 $PROOF. She staked 100, so that is 150 in profit.

Notice the twist. The crowd piled onto Falling, so the smaller Rising crowd split the pot fewer ways and each won more. Your payout hangs on how many others picked your side.

Then it loops. A new round opens, the needle keeps swinging with the match, and Maya's points ride on a shared leaderboard. One honest caveat. The feed publishes prices in windows, so between updates the needle holds the last real price it saw, then jumps when the next real one lands.

<figure>
<svg viewBox="0 0 700 122" width="100%" xmlns="http://www.w3.org/2000/svg" font-family="-apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif">
  <defs><marker id="ar1" markerWidth="9" markerHeight="9" refX="5.5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b44ec"/></marker></defs>
  <g>
    <rect x="14" y="16" width="100" height="66" rx="12" fill="#ffffff" stroke="#e6e6ec" stroke-width="1.5"/>
    <circle cx="32" cy="34" r="10" fill="#5b44ec"/><text x="32" y="38" text-anchor="middle" font-size="11" font-weight="700" fill="#ffffff">1</text>
    <text x="64" y="58" text-anchor="middle" font-size="11.5" font-weight="600" fill="#14151a">Connect</text><text x="64" y="72" text-anchor="middle" font-size="11.5" font-weight="600" fill="#14151a">wallet</text>
  </g>
  <g>
    <rect x="126" y="16" width="100" height="66" rx="12" fill="#ffffff" stroke="#e6e6ec" stroke-width="1.5"/>
    <circle cx="144" cy="34" r="10" fill="#5b44ec"/><text x="144" y="38" text-anchor="middle" font-size="11" font-weight="700" fill="#ffffff">2</text>
    <text x="176" y="58" text-anchor="middle" font-size="11.5" font-weight="600" fill="#14151a">Get 1,000</text><text x="176" y="72" text-anchor="middle" font-size="11.5" font-weight="600" fill="#14151a">$PROOF</text>
  </g>
  <g>
    <rect x="238" y="16" width="100" height="66" rx="12" fill="#ffffff" stroke="#e6e6ec" stroke-width="1.5"/>
    <circle cx="256" cy="34" r="10" fill="#5b44ec"/><text x="256" y="38" text-anchor="middle" font-size="11" font-weight="700" fill="#ffffff">3</text>
    <text x="288" y="58" text-anchor="middle" font-size="11.5" font-weight="600" fill="#14151a">Round</text><text x="288" y="72" text-anchor="middle" font-size="11.5" font-weight="600" fill="#14151a">opens</text>
  </g>
  <g>
    <rect x="350" y="16" width="100" height="66" rx="12" fill="#ffffff" stroke="#e6e6ec" stroke-width="1.5"/>
    <circle cx="368" cy="34" r="10" fill="#5b44ec"/><text x="368" y="38" text-anchor="middle" font-size="11" font-weight="700" fill="#ffffff">4</text>
    <text x="400" y="58" text-anchor="middle" font-size="11.5" font-weight="600" fill="#14151a">Call it,</text><text x="400" y="72" text-anchor="middle" font-size="11.5" font-weight="600" fill="#14151a">pay entry</text>
  </g>
  <g>
    <rect x="462" y="16" width="100" height="66" rx="12" fill="#ffffff" stroke="#e6e6ec" stroke-width="1.5"/>
    <circle cx="480" cy="34" r="10" fill="#5b44ec"/><text x="480" y="38" text-anchor="middle" font-size="11" font-weight="700" fill="#ffffff">5</text>
    <text x="512" y="58" text-anchor="middle" font-size="11.5" font-weight="600" fill="#14151a">Locked</text><text x="512" y="72" text-anchor="middle" font-size="11.5" font-weight="600" fill="#14151a">on-chain</text>
  </g>
  <g>
    <rect x="574" y="16" width="100" height="66" rx="12" fill="#ffffff" stroke="#e6e6ec" stroke-width="1.5"/>
    <circle cx="592" cy="34" r="10" fill="#5b44ec"/><text x="592" y="38" text-anchor="middle" font-size="11" font-weight="700" fill="#ffffff">6</text>
    <text x="624" y="58" text-anchor="middle" font-size="11.5" font-weight="600" fill="#14151a">Winners</text><text x="624" y="72" text-anchor="middle" font-size="11.5" font-weight="600" fill="#14151a">split pool</text>
  </g>
  <line x1="115" y1="49" x2="125" y2="49" stroke="#5b44ec" stroke-width="1.5" marker-end="url(#ar1)"/>
  <line x1="227" y1="49" x2="237" y2="49" stroke="#5b44ec" stroke-width="1.5" marker-end="url(#ar1)"/>
  <line x1="339" y1="49" x2="349" y2="49" stroke="#5b44ec" stroke-width="1.5" marker-end="url(#ar1)"/>
  <line x1="451" y1="49" x2="461" y2="49" stroke="#5b44ec" stroke-width="1.5" marker-end="url(#ar1)"/>
  <line x1="563" y1="49" x2="573" y2="49" stroke="#5b44ec" stroke-width="1.5" marker-end="url(#ar1)"/>
  <text x="350" y="107" text-anchor="middle" font-size="11.5" font-weight="600" fill="#5c5c66">Then it loops, every few seconds.</text>
</svg>
<figcaption>The round loop.</figcaption>
</figure>

## The pool

The pool is the heart of the game, so here it is in full, with real numbers. Everyone who bets on the same live question drops $PROOF into one shared pot. We take no cut. Whoever called it right splits the whole pot, and your slice matches how much you put in. We are never on the other side of your bet. We just hold the pot until it settles, and that is all.

### Five fans, one question

Spain lead Argentina in the final. A pool opens: "Will Spain's live win chance still be above 42% at the 70th minute?" Five fans buy in.

- Ana stakes 100 on YES
- Ben stakes 25 on YES
- Cara stakes 25 on YES
- Dan stakes 200 on NO
- Eli stakes 150 on NO

The pot is 500 $PROOF. It sits in escrow until the answer is known. Nobody can pull it out early.

ProofBall takes no rake, so the full 500 $PROOF goes to the winners. We collect nothing whether YES or NO comes in, so we never need a side to lose.

Spain hold above 42%, so YES wins. Ana, Ben, and Cara called it. Together they staked 150 $PROOF. The full 500 splits across those 150, which is about 3.33 $PROOF back for every 1 staked.

- Ana: 100 staked, 333 back, 233 profit
- Ben: 25 staked, 83 back, 58 profit
- Cara: 25 staked, 83 back, 58 profit

Dan and Eli picked NO, so they get nothing. Their 350 $PROOF are exactly what paid Ana, Ben, and Cara. That is the point. Winners are paid by losers, not by us. We do not mint new $PROOF to cover a payout. The pot pays itself.

### Your payout tracks your stake, and the crowd

Ana got the biggest slice because she risked the most. Every winner earns the same rate, here about 3.33 back per 1, then multiplies it by their own stake. No favorites.

That rate comes from the crowd, not from us. Only 150 $PROOF backed YES while 350 backed NO, so the YES winners split a big pot among a small group and did well. Flip it. If the crowd had piled onto YES, the same win would pay far less, because more people would share the prize. Back a popular pick and you split with a big crowd. Back a quiet one and, if it lands, you split with few.

### Why a pool beats betting against a house

A bookmaker names a price and takes the other side of your bet. That price has a hidden margin baked in. If too much money lands on the winner, the bookmaker can lose, so it keeps nudging the price to protect itself. Its interests and yours point in opposite directions.

A pool flips that. Our cut is fixed and visible, and the players fund each other. We cannot win or lose on the result, so we have no reason to move a line against you.

### Two edge cases

**What if nobody wins?** Maybe the question voids, or every buyer picked the losing side. Then there is no one to split the pot, so the whole pot rolls forward into the next round. Your stake is not swallowed. It carries over.

**What if everyone wins?** If every buyer lands on the same correct side, there is no losing money to hand out. So everyone just gets their stake back, and there is nothing to settle. A pool only pays a profit when some people are right and some are wrong.

### The honest part

A reminder on where this stands. $PROOF is a real token in your own wallet, but this beta runs on Solana devnet, so it has no cash value. The pool above is the live mechanic, played today with test tokens. Real value would come with a later mainnet release.

One more truth. In a live pool the numbers can still move after you buy, because late money changes the split. The "3.33 back per 1" that Ana saw early is a running snapshot, not a locked promise. The final rate is known only once the pool closes and the pot is divided.

## The $PROOF token and tokenomics

The token in this section, $PROOF, is live today on Solana devnet. It is a real SPL token that sits in your own wallet, not points in our database. Because devnet is a test network, $PROOF has no cash value yet, so nothing real is at stake. A real-value version on Solana mainnet is the next step.

$PROOF is an SPL token. SPL is Solana's standard recipe for a token, so every Solana wallet already knows how to hold it and move it. When we hand you $PROOF, we mint it. Minting just means creating new tokens on the network. After that, the $PROOF is yours.

### Why a token beats points in a database

Points in a company database are an IOU. The company can edit them, freeze them, or wipe them if it shuts down. You have to trust its books.

$PROOF sits under your own wallet key. We cannot quietly change your balance or claw it back. It survives even if ProofBall disappears, and every move is visible on the public ledger. The game shifts from "trust our count" to "check the count yourself."

### You start with 1000 $PROOF, free

Every new player gets a welcome airdrop of 1000 $PROOF, sent to your wallet with no purchase. You can play a long time on that alone and never spend a cent. This is the one and only time we mint $PROOF for you. It happens once per player, at signup.

### Entry fees: 5 $PROOF, or real SOL for a bigger share

Each pool has an entry fee. You pay it one of two ways:

- **5 $PROOF**, the free currency you were airdropped, or
- **0.0005 SOL**. SOL is Solana's own coin, real money you can buy.

Paying in $PROOF is the discount path. It costs half of what the SOL entry is worth, and it gives you a normal share of the pool. Paying in SOL costs more, but it buys a 2x share. If you win, a SOL entry counts double when the pot is split.

Your entry goes into escrow, and here the neutral holder is a smart contract, not us. A smart contract is code that runs on Solana under fixed rules, so nobody can touch the pot early.

### 0% house rake

ProofBall sets the house rake to 0%. We take nothing off the pot. Every $PROOF that goes in gets paid straight back out to the players who called it right. In horse racing that cut runs 15% to 30%, so a 0% rake is a real difference. We do not take a side, so we never need you to lose.

Here is a moment. Spain versus Argentina, and a pool asks whether Spain will hold above 42% at halftime. Ten players enter with 5 $PROOF each, so the pot is 50 $PROOF. Four of them called it right. The full 50 $PROOF splits between those four, 12.5 each. The six who missed funded that payout. We added nothing and kept nothing.

<figure>
<svg viewBox="0 0 700 292" width="100%" xmlns="http://www.w3.org/2000/svg" font-family="-apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif">
  <defs><marker id="ar2" markerWidth="9" markerHeight="9" refX="5.5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b44ec"/></marker></defs>
  <g font-size="12.5" font-weight="700" fill="#14151a" text-anchor="middle">
    <rect x="24" y="14" width="116" height="40" rx="10" fill="#ffffff" stroke="#e6e6ec" stroke-width="1.5"/><text x="82" y="39">5 $PROOF</text>
    <rect x="156" y="14" width="116" height="40" rx="10" fill="#ffffff" stroke="#e6e6ec" stroke-width="1.5"/><text x="214" y="39">5 $PROOF</text>
    <rect x="288" y="14" width="116" height="40" rx="10" fill="#ffffff" stroke="#e6e6ec" stroke-width="1.5"/><text x="346" y="39">5 $PROOF</text>
    <rect x="420" y="14" width="116" height="40" rx="10" fill="#ffffff" stroke="#e6e6ec" stroke-width="1.5"/><text x="478" y="39">5 $PROOF</text>
    <rect x="552" y="14" width="116" height="40" rx="10" fill="#ffffff" stroke="#e6e6ec" stroke-width="1.5"/><text x="610" y="39">5 $PROOF</text>
  </g>
  <text x="346" y="70" text-anchor="middle" font-size="10.5" font-weight="600" fill="#5c5c66">five entries into one pool</text>
  <line x1="346" y1="74" x2="346" y2="94" stroke="#5b44ec" stroke-width="1.5" marker-end="url(#ar2)"/>
  <rect x="246" y="96" width="200" height="58" rx="12" fill="#f1eefd" stroke="#5b44ec" stroke-width="1.75"/>
  <text x="346" y="118" text-anchor="middle" font-size="10" font-weight="700" fill="#5c5c66" letter-spacing="1">POOL</text>
  <text x="346" y="141" text-anchor="middle" font-size="18" font-weight="800" fill="#14151a">25 $PROOF</text>
  <text x="346" y="172" text-anchor="middle" font-size="10.5" font-weight="600" fill="#5c5c66">3 correct callers split it, by stake</text>
  <line x1="346" y1="156" x2="346" y2="198" stroke="#5b44ec" stroke-width="1.5" marker-end="url(#ar2)"/>
  <g font-size="12.5" font-weight="700" fill="#ffffff" text-anchor="middle">
    <rect x="140" y="202" width="120" height="44" rx="10" fill="#5b44ec"/><text x="200" y="229">8.33 $PROOF</text>
    <rect x="290" y="202" width="120" height="44" rx="10" fill="#5b44ec"/><text x="350" y="229">8.33 $PROOF</text>
    <rect x="440" y="202" width="120" height="44" rx="10" fill="#5b44ec"/><text x="500" y="229">8.33 $PROOF</text>
  </g>
  <text x="350" y="276" text-anchor="middle" font-size="11" font-weight="600" fill="#5c5c66">The 2 who missed forfeit their 5 $PROOF to the pool.</text>
</svg>
<figcaption>The pool: 5 play, 3 call it right, and they split the 25 in proportion to their stake.</figcaption>
</figure>

### Sources and sinks: why $PROOF does not inflate

Think of the token in two parts: where new $PROOF comes from, and where it goes.

The only source is the welcome airdrop, 1000 $PROOF, once, per new player. Gameplay never mints more. There is no sink either. Nothing is burned, meaning permanently destroyed, because the rake is 0%.

So $PROOF only circulates. Entry fees flow into pools, and pools flow back out to winners. A player who missed loses their 5 $PROOF. A player who called it gains it. No $PROOF is created or destroyed in a pool. It just moves from one wallet to another.

That makes the game close to zero-sum once the airdrops are out. The total supply grows only when a new player joins and claims their 1000. A token the game printed more of every round would dilute what you already hold. $PROOF does not work that way.

### One honest note

$PROOF is a game token, and we make no claims about its price. In this beta it is a real token on Solana devnet, so it has no cash value and nothing real is at stake. A future mainnet release is where $PROOF, and the optional SOL entry, would carry real value. Even then, the free airdrop is enough to play, and the SOL path stays optional.

## Provably fair, and the architecture

Most prediction apps ask you to trust their database. They record what you picked and what happened, and you take their word that neither was changed. ProofBall is built so you do not have to. You can check the two things that matter yourself: that you called it before the match moved, and that the result you were graded on is the real one.

<figure>
<svg viewBox="0 0 700 210" width="100%" xmlns="http://www.w3.org/2000/svg" font-family="-apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif">
  <defs><marker id="ar3" markerWidth="9" markerHeight="9" refX="5.5" refY="3" orient="auto-start-reverse"><path d="M0,0 L6,3 L0,6 Z" fill="#5c5c66"/></marker></defs>
  <rect x="22" y="66" width="180" height="80" rx="12" fill="#ffffff" stroke="#e6e6ec" stroke-width="1.5"/>
  <text x="112" y="100" text-anchor="middle" font-size="13" font-weight="700" fill="#14151a">Your phone</text>
  <text x="112" y="121" text-anchor="middle" font-size="11.5" fill="#5c5c66">+ Solana wallet</text>
  <rect x="270" y="66" width="180" height="80" rx="12" fill="#f1eefd" stroke="#5b44ec" stroke-width="1.75"/>
  <text x="360" y="100" text-anchor="middle" font-size="13" font-weight="700" fill="#14151a">ProofBall</text>
  <text x="360" y="121" text-anchor="middle" font-size="11.5" fill="#5c5c66">server</text>
  <rect x="506" y="24" width="182" height="66" rx="12" fill="#ffffff" stroke="#e6e6ec" stroke-width="1.5"/>
  <text x="597" y="52" text-anchor="middle" font-size="12.5" font-weight="700" fill="#14151a">TxLINE feed</text>
  <text x="597" y="72" text-anchor="middle" font-size="11" fill="#5c5c66">the real number</text>
  <rect x="506" y="122" width="182" height="66" rx="12" fill="#ffffff" stroke="#e6e6ec" stroke-width="1.5"/>
  <text x="597" y="150" text-anchor="middle" font-size="12.5" font-weight="700" fill="#14151a">Solana devnet</text>
  <text x="597" y="170" text-anchor="middle" font-size="10.5" fill="#5c5c66">$PROOF, proofs, payouts</text>
  <line x1="204" y1="106" x2="268" y2="106" stroke="#5c5c66" stroke-width="1.5" marker-start="url(#ar3)" marker-end="url(#ar3)"/>
  <text x="236" y="98" text-anchor="middle" font-size="9.5" fill="#5c5c66">connect / stake</text>
  <line x1="452" y1="92" x2="504" y2="62" stroke="#5c5c66" stroke-width="1.5" marker-end="url(#ar3)"/>
  <text x="470" y="74" text-anchor="middle" font-size="9.5" fill="#5c5c66">live odds</text>
  <line x1="452" y1="120" x2="504" y2="150" stroke="#5c5c66" stroke-width="1.5" marker-start="url(#ar3)" marker-end="url(#ar3)"/>
  <text x="474" y="142" text-anchor="middle" font-size="9.5" fill="#5c5c66">mint / settle</text>
</svg>
<figcaption>The real number comes from TxLINE. The token and the proofs live on Solana.</figcaption>
</figure>

### The needle shows the real probability

The number on the needle comes straight from the TxLINE live feed, the same football data TxODDS already sells to bookmakers. It arrives de-margined, so the bookmaker's built-in profit cut is stripped out. For the final that reads Spain 42%, Draw 31%, Argentina 27%. Those add up to about 100% because the margin is gone. An ordinary betting line adds up to more than 100%, and the extra is the house's edge hiding in the price.

### Your pick is locked before the needle moves

You call Spain to climb above 42%. The instant you tap, we take a fingerprint of your pick and write it to Solana. The fingerprint is a hash built from your match, your pick, the probability at that moment, and the time. It reveals nothing on its own, but it cannot be faked or back-dated.

This is called a commitment. It proves your call existed before the next goal or card, and that nobody edited it afterward. Think of sealing a prediction in an envelope and getting it timestamped before kickoff. In the app it is one tiny note written to Solana at the moment you lock.

### The result is checkable, not just our word

When a goal lands and the needle moves, your call settles. Every settled pick gets a verify link. TxLINE publishes a single fingerprint of all of the match's real events to Solana. Your verify link recomputes that fingerprint from the exact score used to grade you and checks that it matches the published one. If anyone had quietly changed the result, the two fingerprints would not line up.

You click the link, a block explorer opens, and you see the record for yourself. A block explorer is a public website for reading the Solana ledger. It is free, read-only, and needs no wallet. That is the literal meaning of "the house cannot cheat." You do not trust it. You verify it.

### Under the hood, for technical readers

The browser opens a same-origin stream and never holds a token. The server keeps the TxLINE API token and proxies the live feed to you. The needle reads `Pct`, the de-margined 1X2 StablePrice from the odds feed. On lock, the server hashes `match|market|wallet|pick|prob|time|salt` and writes it as an SPL-Memo on Solana devnet, with a server fee-payer wallet covering the gas so you never need any SOL. To verify, the app makes a read-only call to the `txoracle` program (`validate_stat_v2(...).view()`) that recomputes the proof against the account holding TxODDS's published match roots. No signer, no gas, anyone can run it. Points and the leaderboard live off-chain in a database. Only the commitment and the proof live on-chain, which is what keeps the app both fast and checkable.

### On-chain addresses (Solana devnet)

Everything below is public on the Solana explorer under the devnet cluster.

| What | Address |
| --- | --- |
| $PROOF token mint | `EYYob1mBT42gPmbRM3ca3StVJiCq1S9d8RGCAKMYB2X1` |
| $PROOF token metadata (name, symbol, logo) | `7dcnMrAw8Msmhtr34dycThHw5XfHo7iyaiKoQXbKRDs` |
| `txoracle` verification program | `6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J` |

The token's logo and metadata JSON are stored on Arweave, so the "ProofBall" name and the logo your wallet renders are not served by us; they live on decentralized storage that anyone can fetch.

### The four pieces, and what is real today

ProofBall is four parts. Two run in the live demo. Two describe the real-value version, and we say so plainly.

**The data feed (live today).** TxLINE from TxODDS supplies the real World Cup odds and scores. The de-margined win-probability, the goals, the cards, and the final scores all come from here. Nothing shown as live is invented.

**Your Solana wallet (live today).** You connect a well-known Solana wallet: Phantom, Solflare, or Backpack. Your public key becomes your identity, so there is no password in our database. You hold your own key, and you approve anything you sign.

**The $PROOF token (live today on devnet).** $PROOF is a real SPL token, minted straight to your own wallet, so we cannot silently freeze or edit your balance. It carries on-chain metadata now, so a wallet like Phantom shows it as "ProofBall" with our logo, not a raw string of characters. On the devnet test network it has no cash value. A future mainnet release is where it would carry real value.

**The escrow pool (in progress).** Everyone entering one market puts $PROOF into the same pool, which makes it a parimutuel pool. When the match settles, whoever called it right splits the pot in proportion to their stake. This is the piece we are wiring up now.

## Honest limitations

ProofBall is in beta, and there is no real money in it yet. That is on purpose.

It runs on devnet, which is Solana's test network. $PROOF and the SOL there are test tokens with no cash value, so there is nothing to withdraw today. We built it on devnet to prove the mechanism works before real money is on the line. Real stakes, on Solana mainnet, are the next step, and they will bring the rules that real money requires.

Here is the concrete version. Spain plays Argentina in the final. You call Spain to hold above 42%. If Spain holds and you called it early, you win $PROOF from the pool and climb the leaderboard. In this devnet beta that $PROOF has no cash value, so there is nothing to cash out, and we are not going to imply otherwise.

The prices you see are real, though. They come from a live feed, and they are de-margined. One honest wrinkle. The devnet feed publishes those odds in windows, not every second. Between windows we show you the last real price, and we label it so you know it is not live to the tick.

Now the biggest gap. When you join a pool, the $PROOF backing it sits in an account we control. Today that holder is our server, so you are still trusting us with the balances. But every pick and every settlement is written to Solana. You can check that the game graded you honestly even if you never trust us to hold the pot. The proof is already trustless. The custody is not, yet.

## Roadmap

**Already shipped: a real face for $PROOF in your wallet.** We attached metadata to the mint, which is the token's on-chain origin record, so a wallet like Phantom now shows "ProofBall" and a logo instead of a raw string of characters. That item is done; the rest below is still ahead of us.

**Close the custody gap first.** We want a trustless on-chain escrow program: a small piece of code that runs on Solana, holds the pool, and pays winners by rule. No one, including us, can reach in and move the pot. You would not have to trust our server at all.

**More leagues, then more sports.** Today we run a fixed set of finished World Cup knockout matches as replays. Next we add live games, then club football beyond the World Cup, like the Premier League, La Liga, and the Champions League. After that, other sports entirely. Anything with a live win-probability fits the same game: basketball, tennis, cricket, American football. The mechanic never changes, only the feed behind the needle does.

**Friends pools.** Everyone throws points into one pot, we take a small fixed rake, and whoever called it right splits the rest, in proportion to what they staked. One caveat we will keep repeating: in a small early pool with only a few players, the split can swing hard, so we will always show the pool size.

**Season leaderboards.** Right now standings reset around each match. We want a table that runs the whole season, so one great call in the final still counts toward where you finish.

## FAQ

**Is this gambling?**
Not today. This beta runs on Solana devnet with test tokens that have no cash value, so there is nothing real to win or lose. A future mainnet version with real stakes would be a different matter, and it would follow the rules that apply to it.

**Is it real money?**
Not in this beta. $PROOF lives on the devnet test network, so it has no cash value and you cannot withdraw it. Real value is planned for a later mainnet release.

**Do I need to know crypto?**
No. You sign in with an email or a passkey, which is a face or fingerprint tap, like unlocking your phone. The app quietly sets up a Solana wallet for you, but you never see a key or handle any crypto yourself.

**What is $PROOF worth?**
Nothing in dollars today. $PROOF is a real token, but on the devnet test network it has no cash value. It is what you play and compete with in the beta. A mainnet release is where it would carry real value.

**Where do the odds come from?**
From a live betting data feed, TxLINE, not from us guessing. We show it de-margined, so the bookmaker's profit cut is stripped out and the number is the true chance a team wins right now. When you call Spain to hold above 42%, that 42% is a real probability.

**How do I know it is fair?**
Because your pick is recorded publicly before anyone knows the result. The moment you lock it, we hash it and write that to Solana's public ledger, a record anyone can read. The timestamp later proves you called it early, and there is a free link to check it.

**What happens if I lose?**
You lose the $PROOF you staked to the winners of that pool, and your leaderboard rank slips. In this devnet beta that $PROOF has no cash value, so nothing real is lost. Tap into the next match and keep going.

**Can the house cheat?**
No, and you do not have to trust us on that. Your pick is timestamped on Solana before the result, so we cannot back-date it. The final score is written there too, so we cannot quietly rewrite what happened. Click the verify link and re-check both yourself.

**Why football and the World Cup?**
Football momentum swings fast, so the live win-probability actually moves minute to minute, which is what makes calling it fun. The demo replays 30 finished knockout matches with their real scorelines, including the Spain versus Argentina final. We tell you upfront when a match is a replay, so you always know what you are watching.