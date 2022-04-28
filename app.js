import express, { json } from 'express';
import cors from 'cors';
import Joi from 'joi';  

const app = express();
app.use(cors());
app.use(json());

const participantes = [];

app.post("/participants", async (req, res) => {
    const { name } = req.body;
    const schema = Joi.string().trim().required().empty(" ");

    try{
        const value = await schema.validateAsync(name);
        const jaExisteParticipante = participantes.find((participante) => {
            return value === participante.name;
        })
        if(!jaExisteParticipante){
            participantes.push({
                name:value,
                lastStatus: Date.now()
            });
        } else{
            res.sendStatus(409);
        }
        res.sendStatus(201);
    }catch(e){
        res.sendStatus(422);
    }
});

app.get("/participants", (req, res) => {
    res.send(participantes);
})

app.listen(5000);
