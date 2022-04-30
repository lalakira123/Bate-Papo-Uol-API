import express, { json } from 'express';
import cors from 'cors';
import Joi from 'joi';  
import { MongoClient } from 'mongodb';
import dayjs from 'dayjs';
import dotenv from 'dotenv';
import { stripHtml } from 'string-strip-html';

const app = express();
app.use(cors());
app.use(json());
dotenv.config();

//DB
let database;
const mongoClient = new MongoClient(process.env.MONGO_URI);
const db = process.env.BANCO_MONGO;

//Participants
app.post("/participants", async (req, res) => {
    const { name } = req.body;
    const nomeSanitizado = stripHtml(name).result;
    const schema = Joi.string().trim().required();

    try{
        await mongoClient.connect();
        database = mongoClient.db(db);

        const value = await schema.validateAsync(nomeSanitizado);
        const existeParticipante = await database.collection('participants').findOne({ name:value });
        if(!existeParticipante){
            await database.collection('participants').insertOne({
                name: value,
                lastStatus: Date.now()
            });

            const horario = dayjs().locale('pt-br').format('HH:mm:ss');
            await database.collection('messages').insertOne({
                from: value,
                to: 'Todos',
                text: 'entra na sala...',
                type: 'status',
                time: horario
            });

            res.sendStatus(201);
        } else{
            res.sendStatus(409);
        }

        mongoClient.close();
    }catch(e){
        res.sendStatus(422);
        mongoClient.close();
    }
});

app.get("/participants", async (req, res) => {
    try{
        await mongoClient.connect();
        database = mongoClient.db(db);

        const participantes = await database.collection('participants').find({}).toArray();
        res.send(participantes);
        mongoClient.close();
    }catch(e){
        res.send(e);
    }
})

//Messages
app.post("/messages", async (req, res) => {
    const { to, text, type } = req.body;
    const { user } = req.headers;
    const userSanitizado = stripHtml(user).result;
    const schema = Joi.object({
        to: Joi.string().trim().required(),
        text: Joi.string().trim().required(),
        type: Joi.string().valid('message', 'private_message').required(),
        from: Joi.string().valid(userSanitizado)
    })

    try{
        await mongoClient.connect();
        database = mongoClient.db(db);

        const usuario = await database.collection('participants').findOne({ name: userSanitizado });
        if(!usuario){
            res.sendStatus(422);
            mongoClient.close();
            return;
        }

        const value = await schema.validateAsync({ 
            from: userSanitizado, 
            to, 
            text: stripHtml(text).result, 
            type 
        });
        const horario = dayjs().locale('pt-br').format('HH:mm:ss');
        await database.collection('messages').insertOne(
            {
                ...value,
                time: horario
            }
        )

        res.sendStatus(201);
        mongoClient.close();
    }catch(e){
        res.sendStatus(422);
        mongoClient.close();
    }
})

app.get("/messages", async ( req, res ) => {
    const limit = parseInt(req.query.limit);
    const { user } = req.headers;
    const userSanitizado = stripHtml(user).result;

    try{
        await mongoClient.connect();
        database = mongoClient.db(db);

        const mensagens = await database.collection('messages').find({$or:[
            {to: userSanitizado},
            {from: userSanitizado},
            {to: 'Todos'},
            {type: 'message'}
        ]}).toArray();

        if(limit){
            mensagens.reverse();
            const mensagensLimitadas = mensagens.filter((mensagem, indice) => {
                return indice < limit;
            })
            mensagensLimitadas.reverse();
            res.send(mensagensLimitadas);
            mongoClient.close();
            return;
        }

        res.send(mensagens);
        mongoClient.close();
    }catch(e){
        res.send(e);
        mongoClient.close();
    }
});

app.delete('/messages/:id', async (req, res) => {
    const { id } = req.params;
    const { user } = req.headers;
    const userSanitizado = stripHtml(user).result;

    try{
        await mongoClient.connect();
        database = mongoClient.db(db);

        const existeMensagem = await database.collection('messages').findOne({_id: new ObjectId(id)});
        if(!existeMensagem){
            res.sendStatus(404);
            mongoClient.close();
            return;
        } else if(existeMensagem.from !== userSanitizado){
            res.sendStatus(401);
            mongoClient.close();
            return;
        }

        await database.collection('messages').deleteOne( { _id: existeMensagem._id } )

        mongoClient.close();
    }catch(e){
        console.log(e);
        mongoClient.close();
    }
});

app.put('/messages/:id', async (req, res) => {
    const { id } = req.params;
    const { user } = req.headers;
    const { to, text, type } = req.body;
    const userSanitizado = stripHtml(user).result;
    const schema = Joi.object({
        to: Joi.string().trim().required(),
        text: Joi.string().trim().required(),
        type: Joi.valid('message', 'private_message'),
        from: Joi.valid( userSanitizado )
    })

    try{
        await mongoClient.connect();
        database = mongoClient.db(db);

        const value = await schema.validateAsync({
            to,
            text: stripHtml(text).result,
            type,
            from: userSanitizado
        })

        const existeUsuario = await database.collection('participants').findOne({ name: userSanitizado });
        if(!existeUsuario){
            res.sendStatus(422);
            mongoClient.close();
            return;
        }

        const existeMensagem = await database.collection('messages').findOne({ _id: new ObjectId( id ) });
        if(!existeMensagem){
            res.sendStatus(404);
            mongoClient.close();
            return;
        } else if( existeMensagem.from !== userSanitizado ){
            res.sendStatus(401);
            mongoClient.close();
            return;
        }

        await database.collection('messages').updateOne({
            _id: existeMensagem._id
        }, { $set: value });

        res.sendStatus(200);
        mongoClient.close();
    }catch(e){
        res.sendStatus(422);
        mongoClient.close();
    }
});

//Status
app.post('/status', async (req, res) => {
    const { user } = req.headers;
    const userSanitizado = stripHtml(user).result;
    try{
        await mongoClient.connect();
        database = mongoClient.db(db);

        const existeUsuario = await database.collection('participants').findOne({ name: userSanitizado });
        if(!existeUsuario){
            res.sendStatus(404);
            mongoClient.close();
            return;
        }

        await database.collection('participants').updateOne({ 
            name: userSanitizado
        }, { $set: { lastStatus: Date.now() }});

        res.sendStatus(200);
        mongoClient.close();
    }catch(e){
        res.send(e);
        mongoClient.close();
    }
})

//Remoção Automática
async function removerUsuario(){
    try{
        await mongoClient.connect();
        database = mongoClient.db(db);

        const usuariosOciosos = await database.collection('participants').find({ lastStatus: 
            { $lt: Date.now()-10000 }
        }).toArray();

        const horario = dayjs().locale('pt-br').format('HH:mm:ss');
        usuariosOciosos.forEach( async (usuario) => {
            try{
                await database.collection('messages').insertOne( {
                    from: usuario.name,
                    to: 'Todos',
                    text: 'sai da sala...',
                    type: 'status',
                    time: horario
                } );  
            }catch(e){
                console.log(e);
            }     
        });

        await database.collection('participants').deleteMany( { lastStatus: { $lt: Date.now()-10000 } } );

        mongoClient.close();
    }catch(e){
        console.log(e);
        mongoClient.close();
    }   
}

function automatizarRemocao() {
    setInterval( removerUsuario , 15000);
}

automatizarRemocao();

app.listen(process.env.PORTA);
