import cors from "cors"
import express from "express"
import bodyParser from "body-parser"
import {MongoClient,ObjectId} from "mongodb"
import multer from "multer"
import { fileURLToPath } from "url"
import path from "path"

const PORT = process.env.PORT|| 3001;
const app=express()
app.use(cors())
app.use(bodyParser.urlencoded({extended:true}))
//per salvare le immagini in uploads
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname)+".jpg");
    }
});
const fileFilter = (req, file, cb) => {
    if (file.mimetype == 'image/jpeg' || file.mimetype == 'image/png') {
        cb(null, true);
    } else {
        cb(null, false);
    }
}
const upload = multer({ storage: storage, fileFilter: fileFilter });
//fammi vedere che è attivo
app.listen(PORT,()=>{
    console.log("run");
})
const client=new MongoClient("mongodb://apo:jac2001min@cluster0-shard-00-00.pdunp.mongodb.net:27017,cluster0-shard-00-01.pdunp.mongodb.net:27017,cluster0-shard-00-02.pdunp.mongodb.net:27017/?ssl=true&replicaSet=atlas-me2tz8-shard-0&authSource=admin&retryWrites=true&w=majority")
//signup attivita
app.put("/signup", async (req,res)=>{
    let info=JSON.parse(Object.keys(req.body)[0]);
    let countError=0
    let error="non hai compilato il campo: "
    if(info.nomeCognome===""){
        countError++
        error=error+"nome e cognome, "
    }
    if(info.password===""){
        countError++
        error=error+"password, "
    }
    if(info.email===""){
        countError++
        error=error+"email, "
    }
    if(info.anni===""){
        countError++
        error=error+"anni, "
    }
    if(info.professione==="0"){
        countError++
        error=error+"indirizzo della attività, "
    }
    if(info.img===""){
        countError++
        error=error+"immagine, "
    }
    if(countError>0){
        res.status(203).send(error)
    }else{
        client.db("face").collection("users").findOne({email:info.email}).then(e=>{
            if(!e){
                client.db("face").collection("users").insertOne(info).then(i=>{
                    if(!i){
                        res.status(203).send("Non è avvenuto corretamente il procedimento")
                    }else{
                        res.send(i.insertedId)
                    }
                })
            }else{
                res.status(203).send("Utente già registrata")
            }
        })
    }
    
})
//login attivita
app.put("/login", async (req,res)=>{
    let info=JSON.parse(Object.keys(req.body)[0]);
    let countError=0
    let error="non hai compilato il campo: "
    if(info.password===""){
        countError++
        error=error+"password, "
    }
    if(info.email===""){
        countError++
        error=error+"email, "
    }
    if(countError>0){
        res.status(203).send(error)
    }else{
        client.db("face").collection("users").findOne({password:info.password,email:info.email}).then(e=>{
            if(e){
                res.send(e._id)
            }else{
                res.status(203).send("Utente non esistente, Registrati!")
            }
        })
    }
    
})
//rimani loggato
app.put('/stayLogin', async(req, res)=>{
    let info=JSON.parse(Object.keys(req.body)[0]);
    client.db("face").collection("users").findOne({_id:new ObjectId(info.id)}).then(e=>{
        if(e){
            res.send(e._id)
        }else{
            res.status(203).send("Utente non esistente, Registrati!")
        }
    })
});
//salva immagine
app.post('/upload', upload.single('file'),async(req, res)=>{
    res.json(req.file);
});
//mostra immagine
app.get('/uploads/:filename',async(req, res)=>{
    res.sendFile("/uploads/"+req.params.filename,{ root: __dirname })
})
app.get("/users",async(req, res)=>{
    let array=[]
    client.db("face").collection("users").find().forEach(e=>{
        array.push(e)
    }).then(()=>res.send(array))
})
app.get("/user/:userId",async(req, res)=>{
    client.db("face").collection("users").findOne({_id:new ObjectId(req.params.userId)}).then(e=>{
        if(!e){
            res.status(203).send("Errore: User non trovato!")
        }else{
            res.send(e)
        }
    })
})
app.put("/modificaInfo",async(req, res)=>{
    let info=JSON.parse(Object.keys(req.body)[0]);
    let countError=0
    let error="non hai compilato il campo: "
    if(info.nomeCognome===""){
        countError++
        error=error+"nome e cognome, "
    }
    if(info.anni===""){
        countError++
        error=error+"anni, "
    }
    if(countError>0){
        res.status(203).send(error)
    }else{
        client.db("face").collection("users").findOne({_id:new ObjectId(info.id)}).then(e=>{
            if(!e){
                res.status(203).send("Utente non trovato!")
            }else{
                client.db("face").collection("users").updateOne({_id:new ObjectId(info.id)},{$set:{nomeCognome:info.nomeCognome,anni:info.anni,dimmiDiPiu:info.dimmiDiPiu,social:{facebook:info.facebook,instagram:info.instagram,twitter:info.twitter}}}).then(i=>{
                    if(!i){
                        res.status(203).send("Qualcosa è andato storto! Riprova")
                    }else{
                        res.send("ok")
                    }
                })
            }
        })
    }
})