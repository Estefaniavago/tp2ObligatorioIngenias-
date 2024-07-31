const dotenv = require("dotenv");
const express = require("express");
const app = express();
const { connectToMongoDB, disconnectToMongoDB } = require("./src/mongoDb");
const bodyParser = require("body-parser");
const PORT = process.env.PORT || 3000;

/*      MIDDLEWARE      */
dotenv.config();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use((req, res, next) => {
  res.header("Content-Type", "application/json; charset=utf-8");
  next();
});

/*      WEB SERVER      */
app.listen(PORT, () => {
  console.log(`API corriendo en el puerto http://localhost:${PORT}`);
});

/*      ENDPOINTS       */
//Endpoint HOME
app.get("/", (req, res) => {
  res.set("Content-Type", "text/html");
  res.status(200).send("<html><body><h1>Bienvenid@s a HOME</h1></body></html>");
});

/*
El código es super entendible y hace lo que tiene que hacer pero me gustaría dejar aclarado algunos ítems para la próxima.
Manejo de errores: Los mensajes de error podrían ser más descriptivos para ayudar a las personas usuarias a entender mejor el problema.
Principio DRY-Fundamental que lo veo acá- (Don't Repeat Yourself): Extraer la lógica de conexión y desconexión a MongoDB en funciones reutilizables podría 
mejorar la reutilización y la legibilidad del código.
Registro de eventos (Logging): Mejorar el registro de eventos añadiendo más información contextual, como cuál recurso se intentó eliminar.
Mensajes de respuesta: Estandarizar y estructurar los mensajes de respuesta para mantener la consistencia, potencialmente utilizando formato JSON.
Validación: Realizar validaciones adicionales sobre el parámetro codigo más allá de solo verificar si es un número, para asegurar la integridad de los datos de entrada.
Nuevamente son consejos, realmente las felicito por el código.
*/

//Endpoint GET para obtener todas las computadoras

app.get("/computadoras", async (req, res) => {
  const client = await connectToMongoDB();
  if (!client) {
    res.status(503).send("Error al conectar con la base de datos");
    return;
  }
  const db = client.db("Grupo06");
  const pc = await db.collection("computadoras").find().toArray();
  await disconnectToMongoDB();

  pc.length == 0
    ? res.status(404).send("No se encontraron productos ")
    : res.status(200).json(pc);
});

//Endpoint GET para obtener una computadora por codigo

app.get("/computadoras/:codigo", async (req, res) => {
  const computadoraID = parseInt(req.params.codigo) || 0;

  const client = await connectToMongoDB();
  if (!client) {
    res.status(503).send("Error al conectarse a MongoDB");
    return;
  }

  const db = client.db("Grupo06");
  const computadora = await db
    .collection("computadoras")
    .findOne({ codigo: computadoraID });
  await disconnectToMongoDB();
  !computadora
    ? res.status(404).send("No encontre la pc con ese codigo " + computadoraID)
    : res.status(200).json(computadora);
});

//Endpoint GET para obtener todas las computadoras por nombre o descripcion (categoria)
app.get("/computadoras/search/:search", async (req, res) => {
  const search = req.params.search;
  const client = await connectToMongoDB();

  if (!client) {
    res.status(503).send("Error al conectar con la base de datos");
    return;
  }

  const regex = new RegExp(search.toLowerCase(), "i");
  const db = client.db("Grupo06");
  const computadoras = await db
    .collection("computadoras")
    .find({ $or: [{ nombre: regex }, { categoria: regex }] })
    .toArray();
  await disconnectToMongoDB();

  computadoras.length == 0
    ? res
        .status(404)
        .send(
          "No se encontraron computadoras con el nombre o categoria " + search
        )
    : res.status(200).json(computadoras);
});

//Endpoint POST para agregar una computadora
app.post("/computadoras", async (req, res) => {
    const nuevaCompu = req.body
    console.log(req.body)
    if(Object.keys(nuevaCompu).length === 0){
        res.status(400).send("Error en el formato de datos a crear.");
        return;
    }

    const client = await connectToMongoDB();
    if(!client){
        res.status(503).send("Error al conectar con base de datos");
        return;
    }

    const db = client.db('Grupo06')
    const collection = await db.collection('computadoras')
    
    if (await collection.findOne({codigo: nuevaCompu.codigo})) {
        res.status(501).send('Ya existe una computadora con ese codigo')
        return      
    }

    collection.insertOne(nuevaCompu)
    .then(() => {

        console.log("Nueva computadora creada con exito: ")
        res.status(201).send(nuevaCompu)

    }).catch(err => {
        console.error(err)
        res.status(500).send('Error al crear un nuevo producto')

    }).finally(async () => { await disconnectToMongoDB() })

});

//Endpoint PUT para modificar una computadora
app.put("/computadoras/:codigo", async (req, res) => {
  const codigo = req.params.codigo;
  const update = req.body;
  console.log(update);

  if (Object.keys(update).length === 0) {
    res.status(400).send("Falta el cuerpo del mensaje");
    return;
  }

  const client = await connectToMongoDB();
  if (!client) {
    res.status(503).send("Error al conectar con la base de datos");
    return;
  }

  const db = client.db("Grupo06");
  const computadoras = await db.collection("computadoras");
  const computadoraEncontrada = await computadoras.findOne({
    codigo: parseInt(codigo),
  });

  console.log(computadoraEncontrada);
  if (!computadoraEncontrada) {
    res.status(404).send("No se encontro la computadora con codigo " + codigo);
    return;
  }

  //Incluye solo los campos del objeto que existen en la base de datos
  for (const campos in update) {
    if (!computadoraEncontrada.hasOwnProperty(campos)) {
      res
        .status(500)
        .send(
          `Error al actualizar el producto, campo ${campos} no encontrado en la base de datos`
        );
      return;
    }
  }

  computadoras
    .updateOne({ codigo: parseInt(codigo) }, { $set: update })
    .then(() => {
      console.log(`Producto con codigo ${codigo} actualizado correctamente.`);
      res.status(201).send(update);
    })
    .catch((error) => {
      console.error("Error al actualizar el producto", error);
      res.status(500).send("Error al actualizar el producto");
    })
    .finally(async () => {
      await disconnectToMongoDB();
    });
});

//Endpoint DELETE para eliminar una computadora

app.delete("/computadoras/:codigo", async (req, res) => {
  const codigo = parseInt(req.params.codigo);

  if (isNaN(codigo)) {
    res.status(400).send('Código inválido');
    return;
  }

  let client;

  try {
    client = await connectToMongoDB();
    if (!client) {
      res.status(500).send('Error al conectarse a MongoDB');
      return;
    }

    const db = client.db('Grupo06');
    const collection = db.collection('computadoras');

    const result = await collection.deleteOne({ codigo });

    if (result.deletedCount === 0) {
      res.status(404).send('Producto no encontrado');
    } else {
      console.log('Producto eliminado');
      res.status(200).send('Producto eliminado');
    }
  } catch (err) {
    console.error(err);
    res.status(500).send('Error al eliminar producto');
  } finally {
    if (client) {
      await disconnectToMongoDB(client);
    }
  }
});

//Endpoint NOT FOUND
app.get("*", (req, res) => {
  res.status(404).json({
    error: "404",
    message: "No se encuentra la ruta solicitada",
  });
});

//Sobre el glosario de errores no es necesario dejarlo en el código cuando ya lo tienen en el readme. 
//Comentarios en .js intenten que sea una explicación minima de una función.

/*      GLOSARIO DE ERRORES
200 OK: Respuesta estándar para solicitudes correctas.
201 Created: La solicitud ha tenido éxito y se ha creado o autualizado recurso.
400 Bad Request: La solicitud contiene sintaxis incorrecta o no puede procesarse.
404 Not Found: El servidor no pudo encontrar el contenido solicitado.
500 Internal Server Error : Indica que ante una solicitud a nuestro servidor, este no pudo completarla.
501 Not Implemented: La solicitud no se ha implementado.
503 Service Unavailable: El servidor no está disponible.
*/
