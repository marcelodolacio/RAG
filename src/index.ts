import { HuggingFaceTransformersEmbeddings } from "@langchain/community/embeddings/huggingface_transformers";
import { CONFIG } from "./config.ts";
import { DocumentProcessor } from "./documentProcessor.ts";
import { type PretrainedOptions } from "@huggingface/transformers";
import { Neo4jVectorStore } from "@langchain/community/vectorstores/neo4j_vector";
import { ChatOpenAI } from "@langchain/openai";
import { AI } from "./ai.ts";
import { writeFile, mkdir } from 'node:fs/promises';
import express from 'express';
import cors from 'cors';

let _neo4jVectorStore = null

async function clearAll(vectorStore: Neo4jVectorStore, nodeLabel: string): Promise<void> {
    console.log("🗑️  Removendo todos os documentos existentes...");
    await vectorStore.query(
        `MATCH (n:\`${nodeLabel}\`) DETACH DELETE n`
    )
    console.log("✅ Documentos removidos com sucesso\n");
}


try {
    console.log("🚀 Inicializando sistema de Embeddings com Neo4j...\n");

    const documentProcessor = new DocumentProcessor(
        CONFIG.pdf.path,
        CONFIG.textSplitter,
    )
    const documents = await documentProcessor.loadAndSplit()

    const embeddings = new HuggingFaceTransformersEmbeddings({
        model: CONFIG.embedding.modelName,
        pretrainedOptions: CONFIG.embedding.pretrainedOptions as PretrainedOptions
    })

    const nlpModel = new ChatOpenAI({
        temperature: CONFIG.openRouter.temperature,
        maxRetries: CONFIG.openRouter.maxRetries,
        modelName: CONFIG.openRouter.nlpModel,
        openAIApiKey: CONFIG.openRouter.apiKey,
        configuration: {
            baseURL: CONFIG.openRouter.url,
            defaultHeaders: CONFIG.openRouter.defaultHeaders
        }

    })
    // const response = await embeddings.embedQuery(
    //     "JavaScript"
    // )
    // const response = await embeddings.embedDocuments([
    //     "JavaScript"
    // ])
    // console.log('response', response)

    _neo4jVectorStore = await Neo4jVectorStore.fromExistingGraph(
        embeddings,
        CONFIG.neo4j
    )

    clearAll(_neo4jVectorStore, CONFIG.neo4j.nodeLabel)
    for (const [index, doc] of documents.entries()) {
        console.log(`✅ Adicionando documento ${index + 1}/${documents.length}`);
        await _neo4jVectorStore.addDocuments([doc])
    }
    console.log("\n✅ Base de dados populada com sucesso!\n");


    // ==================== STEP 2: START WEBSERVER ====================
    console.log("🔍 ETAPA 2: Iniciando o servidor web...\n");

    const ai = new AI({
        nlpModel,
        debugLog: console.log,
        vectorStore: _neo4jVectorStore,
        promptConfig: CONFIG.promptConfig,
        templateText: CONFIG.templateText,
        topK: CONFIG.similarity.topK,
    })

    const app = express();
    app.use(cors());
    app.use(express.json());
    app.use(express.static('public'));

    app.post('/api/ask', async (req, res) => {
        const { question } = req.body;
        if (!question) {
            return res.status(400).json({ error: 'Pergunta não fornecida.' });
        }
        
        console.log(`\n${'='.repeat(80)}`);
        console.log(`📌 PERGUNTA RECEBIDA: ${question}`);
        console.log('='.repeat(80));

        try {
            const result = await ai.answerQuestion(question);
            if (result.error) {
                return res.status(404).json({ error: result.error });
            }
            
            // Opcional: Salvar a resposta no filesystem como era feito antes
            await mkdir(CONFIG.output.answersFolder, { recursive: true }).catch(() => {});
            const fileName = `${CONFIG.output.answersFolder}/${CONFIG.output.fileName}-${Date.now()}.md`;
            await writeFile(fileName, result.answer!).catch(console.error);

            res.json({ answer: result.answer });
        } catch (e: any) {
            console.error(e);
            res.status(500).json({ error: 'Erro interno no servidor ao processar a pergunta.' });
        }
    });

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`\n🚀 Servidor web rodando em http://localhost:${PORT}`);
        console.log("✅ Acesse a interface no seu navegador para começar a fazer perguntas!\n");
    });

} catch (error) {
    console.error('error', error)
    await _neo4jVectorStore?.close();
}