import express, { json } from 'express';
import cors from 'cors';
import Joi from 'joi';  
import { MongoClient } from 'mongodb';
import dayjs from 'dayjs';

const app = express();
app.use(cors());
app.use(json());

let database;
const mongoClient = new MongoClient("mongodb://localhost:27017");

//Participants
app.post("/participants", async (req, res) => {
    const { name } = req.body;
    const schema = Joi.string().trim().required();

    try{
        await mongoClient.connect();
        database = mongoClient.db("test");

        const value = await schema.validateAsync(name);
        const existeParticipante = await database.collection('participants').findOne({name:value});
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
        database = mongoClient.db("test");

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
    const schema = Joi.object({
        to: Joi.string().trim().required(),
        text: Joi.string().trim().required(),
        type: Joi.string().valid('message', 'private_message').required(),
        from: Joi.string().valid(user)
    })

    try{
        await mongoClient.connect();
        database = mongoClient.db("test");

        const usuario = await database.collection('participants').findOne({ name: user });
        if(!usuario){
            res.sendStatus(422);
            return;
        }

        const value = await schema.validateAsync({ from: user, to, text, type });
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
    
    try{
        await mongoClient.connect();
        database = mongoClient.db("test");

        const mensagens = await database.collection('messages').find({$or:[
            {to: user},
            {from: user},
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
            return;
        }

        res.send(mensagens);
    }catch(e){
        res.send(e);
    }
});

app.listen(5000);
