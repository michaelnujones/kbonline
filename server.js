const express = require("express")
const mysql = require("mysql2")
const bodyParser = require("body-parser")
const multer = require("multer")
const cors = require("cors")
const path = require("path")

const app = express()
const session = require("express-session")
app.use(session({
secret:"rahasia_admin_123",
resave:false,
saveUninitialized:false
}))


app.use(cors())
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({extended:true}))
app.use(express.static("public"))
app.use("/uploads",express.static("uploads"))



/* =========================
   MYSQL DATABASE CONNECT
========================= */

const db = mysql.createConnection({

host:"localhost",
user:"root",
password:"",
database:"bank_system"

})

db.connect(err=>{

if(err){
console.log("Database gagal connect",err)
}else{
console.log("Database berhasil connect")
}

})

/* =========================
   MULTER UPLOAD CONFIG
========================= */

const storage = multer.diskStorage({

destination:function(req,file,cb){
cb(null,"uploads/")
},

filename:function(req,file,cb){
const name = Date.now() + path.extname(file.originalname)
cb(null,name)
}

})

const upload = multer({storage:storage})


/* =========================
   REGISTER
========================= */

app.post("/register",(req,res)=>{

const {
username,
password,
email,
phone,
bank,
atasnama,
rekening
} = req.body

/* CEK USERNAME */

db.query(
"SELECT * FROM users WHERE username=?",
[username],
(err,result)=>{

if(result.length > 0){

return res.send({
status:"exist",
message:"Username sudah digunakan"
})

}

/* INSERT USER */

db.query(
`INSERT INTO users 
(username,password,email,phone,bank,atasnama,rekening)
VALUES (?,?,?,?,?,?,?)`,

[
username,
password,
email,
phone,
bank,
atasnama,
rekening
],

(err,result)=>{

if(err){
console.log(err)
return res.send({status:"error"})
}

res.send({status:"ok"})

})

})

})



/* =========================
   LOGIN
========================= */

app.post("/login",(req,res)=>{

const {username,password} = req.body

db.query(
"SELECT * FROM users WHERE username=? AND password=?",
[username,password],
(err,result)=>{

if(err){
return res.send({status:"error"})
}

if(result.length > 0){

let user = result[0]

// 🔥 SIMPAN SESSION
req.session.username = user.username
req.session.role = user.role

if(user.role === "admin"){
req.session.isAdmin = true
}

res.send({
status:"ok",
user:user,
role:user.role
})

}else{

res.send({status:"fail"})

}

})

})

// function cekAdmin (1x saja)

function cekAdmin(req,res,next){
if(req.session && req.session.isAdmin){
next()
}else{
res.redirect("/login.html")
}
}

// route admin
app.get("/pegawai/1611mic.html", cekAdmin, (req,res)=>{
const path = require("path")

res.sendFile(path.join(__dirname,"pegawai","1611mic.html"))
})

/* =========================
   GET SALDO USER
========================= */

app.get("/saldo/:username",(req,res)=>{

const username = req.params.username

db.query(
"SELECT saldo FROM users WHERE username=?",
[username],
(err,result)=>{

res.send(result[0])

})

})



/* =========================
   DEPOSIT REQUEST
========================= */

app.post("/deposit",upload.single("proof"),(req,res)=>{

const {username,amount,method} = req.body

if(!req.file){
return res.json({status:"error"})
}

const proof = req.file.filename

let info = ""

if(method=="qris") info="QRIS - Michael"
if(method=="bca") info="BCA - Michael"
if(method=="dana") info="DANA - Michael"

db.query(
`INSERT INTO transactions
(username,type,amount,method,info,proof,status)
VALUES(?,?,?,?,?,?,?)`,
[username,"deposit",amount,method,info,proof,"pending"],
(err)=>{

if(err){
console.log(err)
return res.json({status:"error"})
}

res.json({status:"pending"})

})

})



/* ======================
cek status deposit
====================== */
app.get("/checkDepositStatus",(req,res)=>{

const {username} = req.query

db.query(
"SELECT id, status FROM transactions WHERE username=? AND type='deposit' ORDER BY id DESC LIMIT 1",
[username],
(err,result)=>{

if(err) return res.json({status:"error"})

if(result.length === 0){
return res.json({status:"none"})
}

res.json({
id: result[0].id,
status: result[0].status
})

})
})



/* =========================
   WITHDRAW REQUEST
========================= */

app.post("/withdraw",(req,res)=>{

const {username,amount} = req.body

db.query(
`INSERT INTO transactions(username,type,amount,status)
VALUES(?,?,?,'pending')`,
[username,"withdraw",amount],
(err)=>{

if(err){
console.log(err)
return res.send({status:"error"})
}

res.send({status:"pending"})

})

})




/* ======================
cek status withdraw
====================== */
app.get("/checkWithdrawStatus",(req,res)=>{

const {username} = req.query

db.query(
"SELECT id, status FROM transactions WHERE username=? AND type='withdraw' ORDER BY id DESC LIMIT 1",
[username],
(err,result)=>{

if(err) return res.json({status:"error"})

if(result.length === 0){
return res.json({status:"none"})
}

res.json({
id: result[0].id,
status: result[0].status
})

})
})


/* ======================
Reject Deposit
====================== */

app.post("/rejectDeposit",(req,res)=>{

let {id} = req.body

db.query(
"UPDATE transactions SET status='rejected' WHERE id=?",
[id],
()=>{

res.json({success:true})

})

})


/* ======================
Reject Withdraw
====================== */

app.post("/rejectWithdraw",(req,res)=>{

let {id} = req.body

db.query(
"UPDATE transactions SET status='rejected' WHERE id=?",
[id],
()=>{

res.json({success:true})

})

})
/* =========================
   ADMIN LIHAT TRANSAKSI
========================= */

app.get("/transactions",(req,res)=>{

db.query(
`SELECT 
transactions.*,
users.email,
users.phone,
users.bank,
users.atasnama,
users.rekening

FROM transactions

LEFT JOIN users 
ON transactions.username = users.username

ORDER BY transactions.id DESC
`,
(err,data)=>{

if(err){
console.log(err)
return res.send([])
}

res.send(data)

})

})

/* =========================
   ADMIN APPROVE DEPOSIT
========================= */

app.post("/approveDeposit",(req,res)=>{

const {id} = req.body

db.query(
"SELECT * FROM transactions WHERE id=?",
[id],
(err,result)=>{

if(err){
console.log("SELECT ERROR:",err)
return res.send({status:"error"})
}

if(!result || result.length == 0){
return res.send({status:"notfound"})
}

const trx = result[0]

// tambah saldo user
db.query(
"UPDATE users SET saldo = saldo + ? WHERE username=?",
[trx.amount,trx.username],
(err)=>{

if(err){
console.log("UPDATE SALDO ERROR:",err)
return res.send({status:"error"})
}

// update status transaksi
db.query(
"UPDATE transactions SET status='approved' WHERE id=?",
[id],
(err)=>{

if(err){
console.log("UPDATE STATUS ERROR:",err)
return res.send({status:"error"})
}

res.send({status:"approved"})

})

})

})

})


/* =========================
   ADMIN APPROVE WITHDRAW
========================= */

app.post("/approveWithdraw",(req,res)=>{

const {id} = req.body

db.query(
"SELECT * FROM transactions WHERE id=?",
[id],
(err,result)=>{

const trx = result[0]

db.query(
"UPDATE users SET saldo = saldo - ? WHERE username=?",
[trx.amount,trx.username]
)

db.query(
"UPDATE transactions SET status='approved' WHERE id=?",
[id]
)

res.send({status:"approved"})

})

})

/* =========================
   CARI LAWAN
========================= */


app.post("/cari-lawan",(req,res)=>{

const {username, bet, pick, mode} = req.body

db.query(
`DELETE FROM matchmaking 
WHERE username=? 
AND mode=? 
AND (status='waiting' OR status='matched')`,
[username, mode],
(err)=>{

if(err){
console.log(err)
return res.json({status:"error"})
}

db.query(
"SELECT saldo FROM users WHERE username=?",
[username],
(err,user)=>{

if(err || !user || user.length === 0){
return res.json({status:"error"})
}

if(user[0].saldo < bet){
return res.json({status:"saldo_kurang"})
}

db.query(
`SELECT * FROM matchmaking 
WHERE pick != ? 
AND status='waiting' 
AND mode=? 
AND bet=? 
AND username!=?
AND (type IS NULL OR type='random')
ORDER BY id ASC 
LIMIT 1`,
[pick, mode, bet, username],
(err,result)=>{

if(err){
console.log(err)
return res.json({status:"error"})
}

if(result.length > 0){

let lawan = result[0]
let room = "room_" + Date.now()

db.query(
"UPDATE matchmaking SET status='matched', room=? WHERE id=?",
[room, lawan.id],
(err)=>{

if(err){
console.log(err)
return res.json({status:"error"})
}

db.query(
`INSERT INTO matchmaking(username,bet,pick,mode,status,room)
VALUES(?,?,?,?,?,?)`,
[username, bet, pick, mode, "matched", room],
(err)=>{

if(err){
console.log(err)
return res.json({status:"error"})
}

res.json({
status:"matched",
room:room,
lawan:lawan.username
})

})

})

}else{

db.query(
`INSERT INTO matchmaking(username,bet,pick,mode,status)
VALUES(?,?,?,?,?)`,
[username, bet, pick, mode, "waiting"],
(err)=>{

if(err){
console.log(err)
return res.json({status:"error"})
}

return res.json({status:"waiting"})

})

}

})

})

})

})



/* =========================
   CEK LAWAN
========================= */
app.get("/cek-lawan/:username",(req,res)=>{

const username = req.params.username
const mode = req.query.mode || "m1"

db.query(
`SELECT * FROM matchmaking 
WHERE username=? 
AND mode=? 
AND status='matched'
ORDER BY id DESC 
LIMIT 1`,
[username, mode],
(err,data)=>{

if(err){
console.log(err)
return res.json({status:"error"})
}

if(!data || data.length === 0){
return res.json({status:"waiting"})
}

let player = data[0]

db.query(
`SELECT username,pick,bet FROM matchmaking 
WHERE room=? 
AND username!=? 
AND mode=? 
AND status='matched'
ORDER BY id DESC 
LIMIT 1`,
[player.room, username, mode],
(err,players)=>{

if(err){
console.log(err)
return res.json({status:"error"})
}

if(!players || players.length === 0){
return res.json({status:"waiting"})
}

res.json({
status:"matched",
room:player.room,
lawan:players[0].username,
pickLawan:players[0].pick,
bet:players[0].bet
})

})

})

})


/* =========================
   SISTEM TAX
========================= */

function getTax(bet){

if(bet <= 10000) return 500
if(bet <= 30000) return 2111
if(bet <= 60000) return 3333
if(bet <= 100000) return 7777

return 10000

}






/* =========================
   ROLL DADU SYNC MULTIPLAYER
========================= */
app.post("/roll",(req,res)=>{

const {room, mode} = req.body

db.query(
"SELECT * FROM matchmaking WHERE room=? AND mode=?",
[room, mode],
(err,players)=>{

if(err){
return res.json({status:"error"})
}

if(!players || players.length < 2){
return res.json({status:"wait"})
}

let p1 = players[0]

// ======================
// JIKA SUDAH ADA HASIL
// ======================

if(p1.hasil && p1.hasil !== "rolling"){

return res.json({
status:"roll",
hasil: JSON.parse(p1.hasil),
total: p1.total
})

}

// ======================
// JIKA SEDANG ROLLING
// ======================

if(p1.hasil === "rolling"){

return res.json({status:"wait"})

}

// ======================
// LOCK ROOM
// ======================

db.query(
"UPDATE matchmaking SET hasil='rolling' WHERE room=? AND hasil IS NULL",
[room],
(err,lock)=>{

if(lock.affectedRows === 0){
return res.json({status:"wait"})
}

// ======================
// GENERATE SEKALI
// ======================

let hasil = []
let total = 0

for(let i=0;i<9;i++){

let angka = Math.floor(Math.random()*6)+1

hasil.push(angka)
total += angka

}

db.query(
"UPDATE matchmaking SET hasil=?, total=? WHERE room=?",
[JSON.stringify(hasil), total, room]
)

res.json({
status:"roll",
hasil,
total
})

})

})

})




/* =========================
   SISTEM MENANG (FINAL FIX)
========================= */
app.post("/hasil",(req,res)=>{

const {room, mode} = req.body

db.query(
"SELECT * FROM matchmaking WHERE room=? AND mode=?",
[room, mode],
(err,players)=>{

if(err){
return res.json({status:"error"})
}

if(!players || players.length < 2){
return res.json({status:"wait"})
}

let p1 = players[0]
let p2 = players[1]

// ==========================
// AMBIL HASIL DARI ROLL
// ==========================

if(!p1.hasil || p1.hasil === "rolling"){
return res.json({status:"wait"})
}

let hasil = JSON.parse(p1.hasil)
let total = p1.total

// ==========================
// JIKA WINNER SUDAH ADA
// ==========================

if(p1.winner){

return res.json({
status:"done",
hasil,
total,
winner: p1.winner
})

}

// ==========================
// TENTUKAN MENANG
// ==========================

let hasilGame = total <= 31 ? "kecil" : "besar"

let winner =
(p1.pick === hasilGame)
? p1.username
: p2.username

let bet = p1.bet
let tax = getTax(bet)
let hadiah = (bet * 1) - tax


// ==========================
// UPDATE SALDO
// ==========================

db.query(
"UPDATE users SET saldo = saldo + ? WHERE username=?",
[hadiah, winner]
)

db.query(
"UPDATE users SET saldo = saldo - ? WHERE username!=? AND username IN (?,?)",
[bet, winner, p1.username, p2.username]
)


// ==========================
// SIMPAN WINNER
// ==========================

db.query(
"UPDATE matchmaking SET winner=? WHERE room=?",
[winner, room]
)

res.json({
status:"done",
hasil,
total,
winner
})

})

})




/* =========================
   BATAL CARI
========================= */

app.post("/batal-cari",(req,res)=>{

const {username} = req.body

db.query(
"DELETE FROM matchmaking WHERE username=?",
[username],
(err)=>{

if(err){
console.log(err)
return res.json({status:"error"})
}

res.json({status:"ok"})

})

})


/* =========================
   RIWAYAT USER
========================= */

app.get("/history/:username",(req,res)=>{

const username = req.params.username

db.query(
"SELECT * FROM transactions WHERE username=? ORDER BY id DESC",
[username],
(err,result)=>{

res.send(result)

})

})



/* =========================
 buat kode privet room
========================= */
function generateCode(){
return Math.random().toString(36).substring(2,8).toUpperCase()
}


/* =========================
 create private room
========================= */
app.post("/create-room",(req,res)=>{

const {username, bet, pick, mode} = req.body

// hapus semua room lama user
db.query(
"DELETE FROM matchmaking WHERE username=?",
[username],
(err)=>{
if(err){
console.log(err)
return res.json({status:"error"})
}
})

let code = generateCode()

db.query(
`INSERT INTO matchmaking(username,bet,pick,status,room,roomCode,mode,type)
VALUES(?,?,?,'waiting',NULL,?,?,'private')`,
[username,bet,pick,code,mode],
(err)=>{

if(err){
console.log(err)
return res.json({status:"error"})
}

res.json({
status:"ok",
code:code
})

})

})



/* =========================
 join privet room
========================= */
app.post("/join-room",(req,res)=>{

const {username, code, mode} = req.body

console.log("====== JOIN ROOM ======")
console.log("Username:",username)
console.log("Code:",code)

// ==========================
// CEK HOST ROOM
// ==========================
db.query(
"SELECT * FROM matchmaking WHERE roomCode=? AND status='waiting' AND mode=? AND type='private' AND username!=?",
[code, mode, username],
(err,result)=>{

if(err){
console.log("DB ERROR:",err)
return res.json({status:"error"})
}

if(!result || result.length === 0){
console.log("Room tidak ditemukan")
return res.json({status:"notfound"})
}

let host = result[0]

// ==========================
// CEK SALDO PLAYER
// ==========================
db.query(
"SELECT saldo FROM users WHERE username=?",
[username],
(err,user)=>{

if(err){
console.log("DB ERROR:",err)
return res.json({status:"error"})
}

if(!user || user.length === 0){
return res.json({status:"error"})
}

if(user[0].saldo < host.bet){
return res.json({status:"saldo_kurang"})
}

console.log("Host:",host)

// ==========================
// BUAT ROOM
// ==========================
let room = "room_"+Date.now()
let pickLawan = host.pick === "kecil" ? "besar" : "kecil"

console.log("Room dibuat:",room)

// update host
db.query(
"UPDATE matchmaking SET status='matched', room=? WHERE id=? AND mode=?",
[room,host.id,mode],
(err)=>{
if(err) console.log(err)
})
// insert player
db.query(
`INSERT INTO matchmaking(username,bet,pick,status,room,roomCode,mode,type)
VALUES(?,?,?,?,?,?,?,?)`,
[username,host.bet,pickLawan,"matched",room,code,mode,"private"],
(err)=>{
if(err) console.log(err)
}
)

// ==========================
// RESPONSE
// ==========================
console.log("MATCH BERHASIL")

return res.json({
status:"matched",
room:room,
lawan:host.username,
pick:pickLawan,
bet:host.bet
})

}) // ✅ tutup query saldo

}) // ✅ tutup query matchmaking

}) // ✅ tutup app.post

/* =========================
 CEK ROOM (UNTUK KONFIRMASI)
========================= */
app.get("/cek-room",(req,res)=>{

let code = req.query.code
let mode = req.query.mode || "m1"

db.query(
"SELECT * FROM matchmaking WHERE roomCode=? AND status='waiting' AND mode=? AND type='private'",
[code, mode],
(err,result)=>{

if(err){
console.log("DB ERROR:", err)
return res.json({status:"error"})
}

if(!result || result.length === 0){
return res.json({status:"notfound"})
}

let host = result[0]

res.json({
status:"ok",
host: host.username,
pick: host.pick,
bet: host.bet,
code: code
})

})

})

/* =========================
 cek private match DEBUG FIX
========================= */
app.get("/cek-private",(req,res)=>{

let code = req.query.code
let mode = req.query.mode || "m1"

console.log("========== CEK PRIVATE ==========")
console.log("Code:", code)
console.log("Mode:", mode)

db.query(
"SELECT * FROM matchmaking WHERE roomCode=? AND type='private' AND status='matched' AND mode=?",
[code, mode],
(err,result)=>{

if(err){
console.log("DB ERROR:",err)
return res.json({status:"error"})
}

if(!result || result.length < 2){
return res.json({status:"waiting"})
}

res.json({
status:"matched",
players:result
})

})

})

/* =========================
   CANCEL
========================= */
app.post("/cancel-room", (req, res) => {

const { username } = req.body

console.log("Cancel dipanggil oleh:", username)

// 🔥 ambil room user
db.query(
"SELECT room FROM matchmaking WHERE username=?",
[username],
(err, result) => {

if(err){
console.log(err)
return res.json({status:"error"})
}

// 🔥 jika user tidak ada
if(!result || result.length === 0){
return res.json({status:"ok"})
}

let room = result[0].room

// 🔥 hapus semua dalam room
if(room){

db.query(
"DELETE FROM matchmaking WHERE room=?",
[room],
(err)=>{
console.log("Room dihapus:", room)
res.json({status:"ok"})
})

}else{

// 🔥 hapus waiting user
db.query(
"DELETE FROM matchmaking WHERE username=?",
[username],
(err)=>{
console.log("Waiting dihapus:", username)
res.json({status:"ok"})
})

}

})
})




/* =========================
   LAWAN BOT
========================= */

app.post("/lawan-bot", (req, res) => {

const { username, bet, pick } = req.body

if (!username || !bet || !pick) {
    return res.json({
        status: "error",
        message: "Data tidak lengkap"
    })
}

const taruhan = parseInt(bet)

if (taruhan <= 0) {
    return res.json({
        status: "error",
        message: "Taruhan tidak valid"
    })
}

/* =========================
   CEK SALDO USER
========================= */

db.query(
"SELECT saldo FROM users WHERE username=?",
[username],
(err, result) => {

    if (err) {
        console.log(err)
        return res.json({
            status: "error"
        })
    }

    if (!result.length) {
        return res.json({
            status: "error",
            message: "User tidak ditemukan"
        })
    }

    let saldoUser = parseInt(result[0].saldo)

    if (saldoUser < taruhan) {
        return res.json({
            status: "saldo_kurang"
        })
    }


/* =========================
   TENTUKAN HASIL (BOT 70%)
========================= */

let userMenang = Math.random() <= 0.30

/* =========================
   TARGET HASIL
========================= */

let target

if (userMenang) {
    target = pick // user harus menang → hasil harus sama
} else {
    target = pick === "besar" ? "kecil" : "besar" // kebalikan → user kalah
}

/* =========================
   GENERATE DADU SESUAI TARGET
========================= */

let hasilDadu = []
let total = 0

while (true) {

    hasilDadu = []
    total = 0

    for (let i = 0; i < 9; i++) {
        let angka = Math.floor(Math.random() * 6) + 1
        hasilDadu.push(angka)
        total += angka
    }

    let hasilGame = total >= 32 ? "besar" : "kecil"

    if (hasilGame === target) break
}

/* =========================
   HASIL AKHIR
========================= */

let hasil = ""
let saldoBaru = saldoUser

if (userMenang) {
    hasil = "menang"
    saldoBaru += taruhan
} else {
    hasil = "kalah"
    saldoBaru -= taruhan
}

    /* =========================
       UPDATE SALDO
    ========================= */

    db.query(
    "UPDATE users SET saldo=? WHERE username=?",
    [saldoBaru, username],
    (err2) => {

        if (err2) {
            console.log(err2)
            return res.json({
                status: "error"
            })
        }

    return res.json({
    status: "success",
    result: hasil,
    total: total,
    dadu: hasilDadu,
    saldo: saldoBaru
})

    })

})
})

/* =========================
   lawan bot m2
========================= */

app.post("/lawan-bot-m2",(req,res)=>{

const { username, bet, pick } = req.body
const taruhan = parseInt(bet)

if(!username || !taruhan || !pick){
return res.json({status:"error"})
}

db.query(
"SELECT saldo FROM users WHERE username=?",
[username],
(err,result)=>{

if(err || !result.length){
return res.json({status:"error"})
}

let saldoUser = parseInt(result[0].saldo)

if(saldoUser < taruhan){
return res.json({status:"saldo_kurang"})
}

// BOT menang 70%, user menang 30%
let userMenang = Math.random() <= 0.30

let targetFinal = userMenang
? pick
: pick === "besar" ? "kecil" : "besar"

function buatRonde(target){
let hasil = []
let total = 0

while(true){
hasil = []
total = 0

for(let i=0;i<9;i++){
let angka = Math.floor(Math.random()*6)+1
hasil.push(angka)
total += angka
}

let hasilGame = total <= 31 ? "kecil" : "besar"

if(hasilGame === target){
return {hasil,total,hasilGame}
}
}
}

let rounds = []

// bikin M1 dan M2
let m1Target = Math.random() < 0.5 ? targetFinal : (targetFinal === "besar" ? "kecil" : "besar")
let m1 = buatRonde(m1Target)

let m2Target

// 50% langsung selesai di M2, 50% lanjut M3
if(Math.random() < 0.5){
m2Target = m1.hasilGame
}else{
m2Target = m1.hasilGame === "besar" ? "kecil" : "besar"
}

let m2 = buatRonde(m2Target)

rounds.push({
roundNo:1,
...m1
})

rounds.push({
roundNo:2,
...m2
})

// kalau M1 dan M2 beda, M3 penentu
if(m1.hasilGame !== m2.hasilGame){
let m3 = buatRonde(targetFinal)
rounds.push({
roundNo:3,
...m3
})
}else{
// kalau M1 M2 sama tapi bukan targetFinal, ubah ulang biar final sesuai target
if(m1.hasilGame !== targetFinal){
rounds = []
let fix1 = buatRonde(targetFinal)
let fix2 = buatRonde(targetFinal)

rounds.push({roundNo:1,...fix1})
rounds.push({roundNo:2,...fix2})
}
}

let finalGame = rounds.length === 3
? rounds[2].hasilGame
: rounds[0].hasilGame

let hasilAkhir = finalGame === pick ? "menang" : "kalah"

let saldoBaru = saldoUser

if(hasilAkhir === "menang"){
let tax = getTax(taruhan)
saldoBaru += taruhan - tax
}else{
saldoBaru -= taruhan
}

db.query(
"UPDATE users SET saldo=? WHERE username=?",
[saldoBaru, username],
(err)=>{

if(err){
return res.json({status:"error"})
}

res.json({
status:"success",
result:hasilAkhir,
rounds,
finalGame,
saldo:saldoBaru
})

})

})

})

/* =========================
   m2
========================= */
app.post("/roll-m2",(req,res)=>{

const {room, mode, roundNo} = req.body
let ronde = parseInt(roundNo || 1)

db.beginTransaction(err=>{

if(err) return res.json({status:"error"})

db.query(
"SELECT * FROM matchmaking WHERE room=? AND mode=? FOR UPDATE",
[room, mode],
(err,players)=>{

if(err){
return db.rollback(()=>res.json({status:"error"}))
}

if(!players || players.length < 2){
return db.rollback(()=>res.json({status:"wait"}))
}

let p1 = players[0]

let data = p1.hasil ? JSON.parse(p1.hasil) : {rounds:[]}

let existing = data.rounds.find(r => parseInt(r.roundNo) === ronde)

if(existing){

return db.commit(()=>{

res.json({
status:"roll",
roundNo: existing.roundNo,
hasil: existing.hasil,
total: existing.total,
hasilGame: existing.hasilGame
})

})

}

let hasil = []
let total = 0

for(let i=0;i<9;i++){
let angka = Math.floor(Math.random()*6)+1
hasil.push(angka)
total += angka
}

let hasilGame = total <= 31 ? "kecil" : "besar"

data.rounds.push({
roundNo: ronde,
hasil,
total,
hasilGame
})

db.query(
"UPDATE matchmaking SET hasil=? WHERE room=? AND mode=?",
[JSON.stringify(data), room, mode],
(err)=>{

if(err){
return db.rollback(()=>res.json({status:"error"}))
}

db.commit(err=>{

if(err){
return db.rollback(()=>res.json({status:"error"}))
}

res.json({
status:"roll",
roundNo: ronde,
hasil,
total,
hasilGame
})

})

})

})

})

})



/* =========================
   Hasil m2
========================= */
app.post("/hasil-m2",(req,res)=>{

const {room, mode} = req.body

db.query(
"SELECT * FROM matchmaking WHERE room=? AND mode=?",
[room, mode],
(err,players)=>{

if(err) return res.json({status:"error"})
if(!players || players.length < 2) return res.json({status:"wait"})

let p1 = players[0]
let p2 = players[1]

if(!p1.hasil) return res.json({status:"wait"})

let data = JSON.parse(p1.hasil)
let rounds = data.rounds

let m1 = rounds.find(r=>r.roundNo===1)
let m2 = rounds.find(r=>r.roundNo===2)
let m3 = rounds.find(r=>r.roundNo===3)

if(!m1){
return res.json({status:"wait"})
}

if(!m2){
return res.json({
status:"next",
nextRound:2,
lastResult:m1.hasilGame
})
}

let finalGame = null

// M1 dan M2 sama = langsung final
if(m1.hasilGame === m2.hasilGame){
finalGame = m1.hasilGame
}else{

// kalau beda tapi M3 belum ada
if(!m3){
return res.json({
status:"next",
nextRound:3,
lastResult:m2.hasilGame
})
}

// M3 jadi penentu
finalGame = m3.hasilGame
}

// kalau winner sudah pernah disimpan, jangan update saldo 2x
if(p1.winner){
return res.json({
status:"done",
winner:p1.winner,
hasilGame:finalGame
})
}

// tentukan winner
let winner =
(p1.pick === finalGame)
? p1.username
: p2.username

let loser =
winner === p1.username
? p2.username
: p1.username

let bet = parseInt(p1.bet)
let tax = getTax(bet)
let hadiah = bet - tax

// tambah saldo pemenang
db.query(
"UPDATE users SET saldo = saldo + ? WHERE username=?",
[hadiah, winner],
(err)=>{

if(err){
console.log(err)
return res.json({status:"error"})
}

// kurang saldo kalah
db.query(
"UPDATE users SET saldo = saldo - ? WHERE username=?",
[bet, loser],
(err)=>{

if(err){
console.log(err)
return res.json({status:"error"})
}

// simpan winner biar saldo tidak dobel
db.query(
"UPDATE matchmaking SET winner=? WHERE room=? AND mode=?",
[winner, room, mode],
(err)=>{

if(err){
console.log(err)
return res.json({status:"error"})
}

res.json({
status:"done",
winner,
loser,
hasilGame:finalGame
})

})

})

})

})
})





/* =========================
   START SERVER
========================= */

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log("Server jalan di port", PORT)
})

console.log("Server running : http://localhost:3000")

