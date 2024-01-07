import cors from "cors"
import express from "express"
import bodyParser from "body-parser"
import {MongoClient,ObjectId} from "mongodb"
import multer from "multer"
import { fileURLToPath } from "url"
import path from "path"
import fileupload from "express-fileupload"
import { uploadFile } from "@uploadcare/upload-client"
import {deleteFile,UploadcareSimpleAuthSchema} from '@uploadcare/rest-client';
import admin from "firebase-admin"
import serviceAccount from "./firebaseConfig.json" assert {type:"json"}

const PORT = process.env.PORT|| 3001;
const app=express()
app.use(cors())
app.use(fileupload());
app.use(bodyParser.urlencoded({extended:true}))
admin.initializeApp({
    credential:admin.credential.cert(serviceAccount)
})
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
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
const client=new MongoClient("mongodb://apo:jac2001min@cluster0-shard-00-00.pdunp.mongodb.net:27017,cluster0-shard-00-01.pdunp.mongodb.net:27017,cluster0-shard-00-02.pdunp.mongodb.net:27017/?ssl=true&replicaSet=atlas-me2tz8-shard-0&authSource=admin&retryWrites=true&w=majority")
//signup attivita
app.put("/signup", async (req,res)=>{
    let info=req.body
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
        if(info.token!==""){
            info.token=[info.token]
        }else{
            delete info.token
        }
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
    let info=req.body
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
                if(info.token!==""){
                    if(e.token&&!e.token.find(i=>info.token===i)){
                        client.db("face").collection("users").updateOne({_id:new ObjectId(e._id)},{$push:{token:info.token}})
                    }else if(!e.token){
                        client.db("face").collection("users").updateOne({_id:new ObjectId(e._id)},{$set:{token:[info.token]}})
                    }
                }
                res.send(e._id)
            }else{
                res.status(203).send("Utente non esistente, Registrati!")
            }
        })
    }
    
})
//rimani loggato
app.put('/stayLogin', async(req, res)=>{
    let info=req.body
    try{
        client.db("face").collection("users").findOne({_id:new ObjectId(info.id)}).then(e=>{
            if(e){
                res.send(e._id)
            }else{
                res.status(203).send("Utente non esistente, Registrati!")
            }
        })
    }catch{
        res.status(203).send("Qualche problema")
    }
});
//salva immagine profilo nella registrazione
app.post('/upload',async(req, res)=>{
    const filename=req.files.file.name+Date.now()+"."+req.files.file.mimetype.split("/")[1]
    const result = await uploadFile(req.files.file.data, {
        publicKey: '8cff886cb01a8f787891',
        store: 1,
        fileName:filename
    }).then(e=>{
        if(e){
            res.send("https://ucarecdn.com/"+e.uuid+"/-/resize/1200x/-/quality/smart/-/format/auto/"+filename);
        }else{
            res.status(203).send("Non è andato bene qualcosa, riprova!")
        }
    })
});
//modifica immagine profilo
app.post('/modifyUpload',async(req, res)=>{
    const filename=req.files.file.name+Date.now()+"."+req.files.file.mimetype.split("/")[1]
    client.db("face").collection("users").findOne({_id:new ObjectId(req.body.id)}).then(e=>{
        if(e){
            const uploadcareSimpleAuthSchema = new UploadcareSimpleAuthSchema({
                publicKey: '8cff886cb01a8f787891',
                secretKey: 'efa83be87027caaa9a56',
            });
            const result = deleteFile({uuid: e.img.split("/")[3]}, {authSchema:uploadcareSimpleAuthSchema}).then(()=>{
                const result1 = uploadFile(req.files.file.data, {
                    publicKey: '8cff886cb01a8f787891',
                    store: 1,
                    fileName:filename
                }).then(i=>{
                    if(i){
                        client.db("face").collection("users").updateOne({_id:new ObjectId(req.body.id)},{$set:{img:"https://ucarecdn.com/"+i.uuid+"/-/resize/1200x/-/quality/smart/-/format/auto/"+filename}}).then((s)=>{
                            if(!s){
                                res.status(203).send("Non è andato bene qualcosa, riprova!")
                            }else{
                                res.send("ok")
                            }
                        })
                    }else{
                        res.status(203).send("Non è andato bene qualcosa, riprova!")
                    }
                })
            })
        }else{
            res.status(203).send("Utente non esistente")
        }
    })
});
//metti post
app.post('/addPost', async(req, res)=>{
    const filename=req.files.file.name+Date.now()+"."+req.files.file.mimetype.split("/")[1]
    const result = await uploadFile(req.files.file.data, {
        publicKey: '8cff886cb01a8f787891',
        store: 1,
        fileName:filename
    }).then(e=>{
        if(e){
            client.db("face").collection("users").findOne({_id:new ObjectId(req.body.id)}).then(i=>{
                if(!i){
                    res.status(203).send("Utente non trovato, riprova!")
                }else{
                    if(i.post&&i.post.length>0){
                        let post=i.post
                        let obj={id:new ObjectId(),img:"https://ucarecdn.com/"+e.uuid+"/-/resize/1200x/-/quality/smart/-/format/auto/"+filename}
                        post.push(obj)
                        client.db("face").collection("users").updateOne({_id:new ObjectId(req.body.id)},{$set:{post:post}}).then((s)=>{
                            if(!s){
                                res.status(203).send("Non è andato bene qualcosa, riprova!")
                            }else{
                                res.send("ok")
                            }
                        })
                    }else{
                        client.db("face").collection("users").updateOne({_id:new ObjectId(req.body.id)},{$set:{post:[{id:new ObjectId(),img:"https://ucarecdn.com/"+e.uuid+"/-/resize/1200x/-/quality/smart/-/format/auto/"+filename}]}}).then((s)=>{
                            if(!s){
                                res.status(203).send("Non è andato bene qualcosa, riprova!")
                            }else{
                                res.send("ok")
                            }
                        })
                    }
                }
            })
            
        }else{
            res.status(203).send("Non è andato bene qualcosa, riprova!")
        }
    })
});
//cancella post
app.post('/delatePost', async(req, res)=>{
    let info=req.body
    const uploadcareSimpleAuthSchema = new UploadcareSimpleAuthSchema({
        publicKey: '8cff886cb01a8f787891',
        secretKey: 'efa83be87027caaa9a56',
    });
    const result = deleteFile({uuid: info.img.split("/")[3]}, {authSchema:uploadcareSimpleAuthSchema}).then(()=>{
        client.db("face").collection("users").updateOne({_id:new ObjectId(info.id)},{$pull:{post:{id:new ObjectId(info.idImmagine)}}}).then(i=>{
            if(!i){
                res.status(203).send("Qualcosa è andato storto! Riprova")
            }else{
                res.send("ok")
            }
        })
    })
})
//prendi tutti gli users per la face detection
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
    let info=req.body
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
        client.db("face").collection("users").updateOne({_id:new ObjectId(info.id)},{$set:{nomeCognome:info.nomeCognome,anni:info.anni,dimmiDiPiu:info.dimmiDiPiu,social:{facebook:info.facebook,instagram:info.instagram,twitter:info.twitter}}}).then(i=>{
            if(!i){
                res.status(203).send("Qualcosa è andato storto! Riprova")
            }else{
                res.send("ok")
            }
        })
    }
})
app.put("/modificaProfessione",async(req, res)=>{
    let info=req.body
    let countError=0
    let error="non hai compilato il campo: "
    if(info.professione==="0"){
        countError++
        error=error+"professione, "
    }
    if(countError>0){
        res.status(203).send(error)
    }else{
        client.db("face").collection("users").updateOne({_id:new ObjectId(info.id)},{$set:{professione:info.professione,infoProfessione:{linkProfessione:info.linkProfessione,descrizioneProfessione:info.descrizioneProfessione}}}).then(i=>{
            if(!i){
                res.status(203).send("Qualcosa è andato storto! Riprova")
            }else{
                res.send("ok")
            }
        })
    }
})
app.put("/modificaAccesso",async(req, res)=>{
    let info=req.body
    let countError=0
    let error="non hai compilato il campo: "
    if(info.email===""){
        countError++
        error=error+"professione, "
    }
    if(info.password===""){
        countError++
        error=error+"professione, "
    }
    if(countError>0){
        res.status(203).send(error)
    }else{
        client.db("face").collection("users").updateOne({_id:new ObjectId(info.id)},{$set:{email:info.email,password:info.password}}).then(i=>{
            if(!i){
                res.status(203).send("Qualcosa è andato storto! Riprova")
            }else{
                res.send("ok")
            }
        })
    }
})
//statistiche
app.put("/statisticaClick",async(req, res)=>{
    let info=req.body
    client.db("face").collection("users").findOne({_id:new ObjectId(info.id)}).then(e=>{
        if(!e){
            res.status(203).send("Errore: User non trovato!")
        }else{
            let statistica={}
            let click=1
            if(e.statistica){
                statistica=e.statistica
                click=e.statistica.click+1
            }
            statistica["click"]=click
            client.db("face").collection("users").updateOne({_id:new ObjectId(info.id)},{$set:{statistica:statistica}}).then(i=>{
                if(!i){
                    res.status(203).send("Qualcosa è andato storto! Riprova")
                }else{
                    res.send("ok")
                }
            })
        }
    })
})
app.put("/statisticaUserTrovato",async(req, res)=>{
    let info=req.body
    client.db("face").collection("users").findOne({_id:new ObjectId(info.id)}).then(e=>{
        if(!e){
            res.status(203).send("Errore: User non trovato!")
        }else{
            let statistica=e.statistica
            let user=[]
            if(e.statistica.userTrovato){
                user=e.statistica.userTrovato
            }
            user.push({user:info.userTrovato,data:info.data})
            statistica["userTrovato"]=user
            client.db("face").collection("users").updateOne({_id:new ObjectId(info.id)},{$set:{statistica:statistica}}).then(i=>{
                if(!i){
                    res.status(203).send("Qualcosa è andato storto! Riprova")
                }
            })
        }
    }).finally(()=>{
        client.db("face").collection("users").findOne({_id:new ObjectId(info.userTrovato)}).then(e=>{
            if(!e){
                res.status(203).send("Errore: User non trovato!")
            }else{
                let statistica=e.statistica
                let user=[]
                if(e.statistica.userTrovante){
                    user=e.statistica.userTrovante
                }
                user.push({user:info.id,data:info.data})
                statistica["userTrovante"]=user
                client.db("face").collection("users").updateOne({_id:new ObjectId(info.userTrovato)},{$set:{statistica:statistica}}).then(i=>{
                    if(!i){
                        res.status(203).send("Qualcosa è andato storto! Riprova")
                    }else{
                        res.send("ok")
                    }
                })
            }
        })
    })
})
app.post("/immagine",async(req,res)=>{
    const filename=req.files.file.name+Date.now()+"."+req.files.file.mimetype.split("/")[1]
    const result = await uploadFile(req.files.file.data, {
        publicKey: '8cff886cb01a8f787891',
        store: 0,
        fileName:filename
    }).then(e=>{
        if(e){
            res.send("https://lens.google.com/uploadbyurl?url="+"https://ucarecdn.com/"+e.uuid+"/-/resize/1200x/-/quality/smart/-/format/auto/"+filename)
        }else{
            res.status(203).send("Qualcosa è andato storto! Riprova")
        }
    })
})
app.put("/msg",async(req,res)=>{
    let info=req.body;
    let mittente=""
    if(info.text!==""){
        await client.db("face").collection("users").findOne({_id:new ObjectId(info.meId)}).then(me=>{
            if(me){
                mittente=me.nomeCognome
                if(me.messaggi){
                    if(me.messaggi[info.luiId]){
                        me.messaggi[info.luiId].push({text:info.text,mittente:new ObjectId(info.meId),dataOra:info.dataOra})
                        const messaggio=me.messaggi
                        client.db("face").collection("users").updateOne({_id:new ObjectId(info.meId)},{$set:{messaggi:messaggio}}).then(i=>{
                            if(!i){
                                res.status(203).send("Qualcosa è andato storto! Riprova")
                            }
                        })
                    }else{
                        me.messaggi[info.luiId]=[{text:info.text,mittente:new ObjectId(info.meId),dataOra:info.dataOra}]
                        const messaggio=me.messaggi
                        client.db("face").collection("users").updateOne({_id:new ObjectId(info.meId)},{$set:{messaggi:messaggio}}).then(i=>{
                            if(!i){
                                res.status(203).send("Qualcosa è andato storto! Riprova")
                            }
                        })
                    }
                }else{
                    const messaggio={[info.luiId]:[{text:info.text,mittente:new ObjectId(info.meId),dataOra:info.dataOra}]}
                    client.db("face").collection("users").updateOne({_id:new ObjectId(info.meId)},{$set:{messaggi:messaggio}}).then(i=>{
                        if(!i){
                            res.status(203).send("Qualcosa è andato storto! Riprova")
                        }
                    })
                }
            }else{
                res.status(203).send("Qualcosa è andato storto! Riprova")
            }
        })
        if(info.meId!==info.luiId){
            await client.db("face").collection("users").findOne({_id:new ObjectId(info.luiId)}).then(lui=>{
                if(lui){
                    if(lui.messaggi){
                        if(lui.messaggi[info.meId]){
                            lui.messaggi[info.meId].push({text:info.text,mittente:new ObjectId(info.meId),dataOra:info.dataOra})
                            const messaggio=lui.messaggi
                            client.db("face").collection("users").updateOne({_id:new ObjectId(info.luiId)},{$set:{messaggi:messaggio}}).then(i=>{
                                if(!i){
                                    res.status(203).send("Qualcosa è andato storto! Riprova")
                                }
                            })
                        }else{
                            lui.messaggi[info.meId]=[{text:info.text,mittente:new ObjectId(info.meId),dataOra:info.dataOra}]
                            const messaggio=lui.messaggi
                            client.db("face").collection("users").updateOne({_id:new ObjectId(info.luiId)},{$set:{messaggi:messaggio}}).then(i=>{
                                if(!i){
                                    res.status(203).send("Qualcosa è andato storto! Riprova")
                                }
                            })
                        }
                    }else{
                        const messaggio={[info.meId]:[{text:info.text,mittente:new ObjectId(info.meId),dataOra:info.dataOra}]}
                        client.db("face").collection("users").updateOne({_id:new ObjectId(info.luiId)},{$set:{messaggi:messaggio}}).then(i=>{
                            if(!i){
                                res.status(203).send("Qualcosa è andato storto! Riprova")
                            }
                        })
                    }
                }else{
                    res.status(203).send("Qualcosa è andato storto! Riprova")
                }
            })
        }
        if(info["token[]"]){
            const payload = {
                tokens:info["token[]"],
                notification: {
                    title:mittente,
                    body:info.text,
                    imageUrl:info.icon
                },
            };
            admin.messaging().sendEachForMulticast(payload).then(e=>{
                if(e){
                    res.send("ok")
                }else{
                    res.send("Qualcosa è andato storto! Riprova")
                }
            }).catch((error) => {
                console.error('Errore nell\'invio del messaggio push:', error);
            });
        }
        
    }else{
        res.status(203).send("Non hai scritto niente. Scrivi il messaggio!")
    }
    
})