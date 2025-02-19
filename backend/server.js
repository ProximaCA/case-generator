require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs").promises;
const fsSync = require("fs");
const sqlite3 = require("sqlite3").verbose();
const dbPath = path.join(__dirname, "results.db");
let db;

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

const bot = require("./telegram-bot");

async function readSystemPrompt() {
  try {
    const promptPath = path.join(__dirname, "prompt.txt");
    const content = await fs.readFile(promptPath, "utf8");
    return content;
  } catch (error) {
    console.error("Error reading prompt file:", error);
    return "";
  }
}

async function readChatPrompt() {
  try {
    const promptPath = path.join(__dirname, "cprompt.txt");
    const content = await fs.readFile(promptPath, "utf8");
    return content;
  } catch (error) {
    console.error("Error reading prompt file:", error);
    return "";
  }
}
app.post("/api/generate-case", async (req, res) => {
  try {
    const { difficulty, language } = req.body;
    const systemPrompt = await readSystemPrompt();

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-5-haiku-20241022",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: `${systemPrompt}\n\nGenerate case difficulty: ${difficulty}. LANGUAGE: ${language}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    res.json({ case: data.content[0].text });
  } catch (error) {
    console.error("Error generating case:", error);
    res.status(500).json({ error: "Failed to generate case" });
  }
});

async function readQuizPrompt() {
  try {
    const promptPath = path.join(__dirname, "qprompt.txt");
    const content = await fs.readFile(promptPath, "utf8");
    return content;
  } catch (error) {
    console.error("Error reading quiz prompt file:", error);
    return "";
  }
}

app.post("/api/generate-quiz", async (req, res) => {
  try {
    const { case: caseData, language } = req.body;
    const quizPrompt = await readQuizPrompt();

    const formattedCase = `
Antecedent: "${caseData.antecedent}"
Belief: "${caseData.belief}"
Consequence: "${caseData.consequence}"`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-5-haiku-20241022",
        max_tokens: 4096,
        messages: [
          {
            role: "user",
            content: `${quizPrompt}\n\nCASE TO USE:\n${formattedCase}\n\nGenerate a quiz based on this case. LANGUAGE: ${language}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const quizData = parseQuizResponse(data.content[0].text);

    res.json(quizData);
  } catch (error) {
    console.error("Error generating quiz:", error);
    res.status(500).json({ error: "Failed to generate quiz" });
  }
});

function parseQuizResponse(response) {
  try {
        const cleanResponse = response
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

        const data = JSON.parse(cleanResponse);

        if (
      !data.quiz ||
      !data.quiz.questions ||
      !Array.isArray(data.quiz.questions)
    ) {
      throw new Error("Invalid quiz data structure");
    }

        return {
      questions: data.quiz.questions.map((q) => ({
        question: q.question,
        options: q.options,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
      })),
      totalQuestions: data.quiz.totalQuestions,
    };
  } catch (error) {
    console.error("Error parsing quiz response:", error);
    throw new Error("Failed to parse quiz data");
  }
}

async function readReflectionPrompt() {
  try {
    const promptPath = path.join(__dirname, "rprompt.txt");
    const content = await fs.readFile(promptPath, "utf8");
    return content;
  } catch (error) {
    console.error("Error reading reflection prompt file:", error);
    return "";
  }
}
app.post("/api/chat", async (req, res) => {
  try {
    const { message, caseData, language, messageHistory = [] } = req.body;     const chatPrompt = await readChatPrompt();

    const formattedCase = `
Current case:
Antecedent: "${caseData.antecedent}"
Belief: "${caseData.belief}"
Consequence: "${caseData.consequence}"`;

        const formattedHistory = messageHistory
      .slice(-10)       .map((msg) => `${msg.role}: ${msg.content}`)
      .join("\n");

    const requestBody = {
      model: "claude-3-5-haiku-20241022",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `${chatPrompt}\n\n${formattedCase}\n\nChat history:\n${formattedHistory}\n\nUser: ${message}\nLANGUAGE: ${language}`,
        },
      ],
    };

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    res.json({ reply: data.content[0].text });
  } catch (error) {
    console.error("Chat error:", error);
    res.status(500).json({ error: "Failed to get chat response" });
  }
});
app.post("/api/generate-reflection", async (req, res) => {
  const MAX_RETRIES = 3;
  let attempts = 0;

  while (attempts < MAX_RETRIES) {
    try {
      const { case: caseData, language } = req.body;
      const reflectionPrompt = await readReflectionPrompt();

      const formattedCase = `
Antecedent: "${caseData.antecedent}"
Belief: "${caseData.belief}"
Consequence: "${caseData.consequence}"`;

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-3-5-haiku-20241022",
          max_tokens: 4096,
          messages: [
            {
              role: "user",
              content: `${reflectionPrompt}\n\nCASE TO USE:\n${formattedCase}\n\nGenerate reflection questions based on this case. LANGUAGE: ${language}`,
            },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const reflectionData = parseReflectionResponse(data.content[0].text);

      return res.json(reflectionData);
    } catch (error) {
      attempts++;
      console.error(`Попытка ${attempts} не удалась:`, error);

      if (attempts === MAX_RETRIES) {
        return res.status(500).json({
          error:
            "Failed to generate reflection questions after multiple attempts",
        });
      }

            await new Promise((resolve) => setTimeout(resolve, 1000 * attempts));
    }
  }
});

function parseReflectionResponse(response) {
  try {
        let data;
    try {
      data = JSON.parse(response);
    } catch {
            const cleanResponse = response
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();

            const jsonMatch = cleanResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        data = JSON.parse(jsonMatch[0]);
      } else {
                const lines = cleanResponse.split("\n").filter((line) => line.trim());
        data = {
          questions: lines.map((line, index) => ({
            question: line.replace(/^\d+\.\s*/, "").trim(),
            hint: null,
          })),
        };
      }
    }

        if (!data.questions || !Array.isArray(data.questions)) {
      throw new Error("Invalid reflection data structure");
    }

        return {
      questions: data.questions.map((q) => ({
        question: typeof q === "string" ? q : q.question,
        hint: q.hint || null,
      })),
    };
  } catch (error) {
    console.error("Error parsing reflection response:", error);
    console.error("Original response:", response);
    throw new Error("Failed to parse reflection data");
  }
}

async function sendTelegramNotification(userData) {
  try {
        const quizQuestions = userData.quizAnswers
      .map((answer, index) => {
        return `${index + 1}. ${
          userData.currentQuizData?.questions[index]?.question || "Question"
        }\n${answer}`;
      })
      .join("\n");

        const reflectionAnswers = userData.reflectionAnswers
      .map((item) => {
        return `${item.questionId}. ${item.question || "Question"}\n${
          item.answer
        }`;
      })
      .join("\n");

    const message = `
🎯 Новый результат!

👤 Пользователь: ${userData.name}
📧 Email: ${userData.email}
📊 Оценка приложения: ${userData.score}/10
📝 Результат квиза: ${userData.quizScore}/${userData.totalQuestions}
🎯 Уровень сложности: ${userData.difficulty}

Case:
Antecedent: "${userData.caseData.antecedent}"
Belief: "${userData.caseData.belief}"
Consequence: "${userData.caseData.consequence}"

Question and Answer:
${quizQuestions}

Reflect:
${reflectionAnswers}

💭 Комментарий: 
${userData.comment || "Без комментария"}

🌍 Язык: ${userData.language}
⏰ Время: ${new Date().toLocaleString()}
`;

    await bot.sendMessage(TELEGRAM_CHAT_ID, message);
  } catch (error) {
    console.error("Telegram notification error:", error);
      }
}

async function saveToDatabase(formData) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run("BEGIN TRANSACTION");

      try {
                db.run(
          `INSERT INTO users (
            name, 
            email, 
            app_score, 
            quiz_score, 
            total_questions, 
            difficulty,
            comment,
            language
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            formData.name,
            formData.email || null,
            formData.score,
            formData.quizScore,
            formData.totalQuestions,
            formData.difficulty,
            formData.comment || null,
            formData.language,
          ],
          function (err) {
            if (err) {
              console.error("Error inserting user:", err);
              db.run("ROLLBACK");
              return reject(err);
            }

            const userId = this.lastID;

                        db.run(
              `INSERT INTO cases (
                user_id, 
                antecedent, 
                belief, 
                consequence,
                language
              ) VALUES (?, ?, ?, ?, ?)`,
              [
                userId,
                formData.caseData.antecedent,
                formData.caseData.belief,
                formData.caseData.consequence,
                formData.language,
              ],
              (err) => {
                if (err) {
                  console.error("Error inserting case:", err);
                  db.run("ROLLBACK");
                  return reject(err);
                }

                                const quizStmt = db.prepare(
                  `INSERT INTO quiz_answers (
                    user_id, 
                    question_number, 
                    question, 
                    answer, 
                    correct_answer,
                    language
                  ) VALUES (?, ?, ?, ?, ?, ?)`
                );

                formData.quizAnswers.forEach((answer, index) => {
                  const question = formData.currentQuizData.questions[index];
                  quizStmt.run(
                    userId,
                    index + 1,
                    question.question,
                    answer,
                    question.correctAnswer,
                    formData.language
                  );
                });

                quizStmt.finalize();

                                const reflectionStmt = db.prepare(
                  `INSERT INTO reflection_answers (
                    user_id, 
                    question_id, 
                    question, 
                    answer,
                    language
                  ) VALUES (?, ?, ?, ?, ?)`
                );

                formData.reflectionAnswers.forEach((answer, index) => {
                  reflectionStmt.run(
                    userId,
                    answer.questionId,
                    answer.question,
                    answer.answer,
                    formData.language
                  );
                });

                reflectionStmt.finalize();

                db.run("COMMIT");
                resolve();
              }
            );
          }
        );
      } catch (error) {
        db.run("ROLLBACK");
        reject(error);
      }
    });
  });
}

app.post("/api/save-results", async (req, res) => {
  try {
    const formData = req.body;

    const message = `
*📊 РЕЗУЛЬТАТЫ ТЕСТА*
━━━━━━━━━━━━━━━━
👤 *Имя:* ${formData.name}
📧 Email: ${formData.email}

⭐️ *Оценка:* ${formData.score}/10
📈 *Тест:* ${formData.quizScore}/${formData.totalQuestions}
🎯 *Сложность:* ${formData.difficulty}
🌍 *Язык:* ${formData.language}
💭 *Комментарий:* ${formData.comment || "Нет комментария"}

*📋 КЕЙС*
━━━━━━━━━━━━━━━━
🔸 *Antecedent:* ${formData.caseData.antecedent}
🔸 *Belief:* ${formData.caseData.belief}
🔸 *Consequence:* ${formData.caseData.consequence}

*❓ КВИЗ*
━━━━━━━━━━━━━━━━${formData.currentQuizData.questions
      .map(
        (q, i) => `

*Вопрос ${i + 1}:* ${q.question}

*Ответ пользователя:*
${
  q.options.find((opt) => opt.value === formData.quizAnswers[i])?.text ||
  "Нет ответа"
}

*Правильный ответ:*
${q.options.find((opt) => opt.value === q.correctAnswer)?.text || "Нет ответа"}
━━━━━━━━━━━━━━━━`
      )
      .join("")}

*🤔 РЕФЛЕКСИЯ*
━━━━━━━━━━━━━━━━${formData.reflectionAnswers
      .map(
        (r) => `

*Вопрос ${r.questionId}:*
${r.question}

*Ответ:*
${r.answer || "Нет ответа"}
━━━━━━━━━━━━━━━━`
      )
      .join("")}`;

        const MAX_LENGTH = 4096;
    for (let i = 0; i < message.length; i += MAX_LENGTH) {
      const part = message.slice(i, i + MAX_LENGTH);
      await bot.sendMessage(TELEGRAM_CHAT_ID, part, {
        parse_mode: "Markdown",
      });
            await new Promise((resolve) => setTimeout(resolve, 100));
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Error saving data:", error);
    res.status(500).json({ error: "Failed to save data" });
  }
});

async function initializeDatabase() {
  try {
        if (db) {
      await new Promise((resolve) => db.close(resolve));
    }

        try {
      if (fsSync.existsSync(dbPath)) {
        await fs.unlink(dbPath);
      }
    } catch (err) {
      console.log("Error removing old database:", err);
    }

        return new Promise((resolve, reject) => {
      const newDb = new sqlite3.Database(dbPath, async (err) => {
        if (err) {
          console.error("Error creating database:", err);
          return reject(err);
        }

        try {
                    await new Promise((res, rej) => {
            newDb.run(
              `CREATE TABLE users (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              name TEXT NOT NULL,
              email TEXT,
              app_score INTEGER NOT NULL,
              quiz_score INTEGER,
              total_questions INTEGER,
              difficulty TEXT,
              comment TEXT,
              language TEXT DEFAULT 'en',
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
              (err) => (err ? rej(err) : res())
            );
          });

          await new Promise((res, rej) => {
            newDb.run(
              `CREATE TABLE cases (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id INTEGER,
              antecedent TEXT,
              belief TEXT,
              consequence TEXT,
              language TEXT DEFAULT 'en',
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY(user_id) REFERENCES users(id)
            )`,
              (err) => (err ? rej(err) : res())
            );
          });

          await new Promise((res, rej) => {
            newDb.run(
              `CREATE TABLE quiz_answers (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id INTEGER,
              question_number INTEGER,
              question TEXT,
              answer TEXT,
              correct_answer TEXT,
              language TEXT DEFAULT 'en',
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY(user_id) REFERENCES users(id)
            )`,
              (err) => (err ? rej(err) : res())
            );
          });

          await new Promise((res, rej) => {
            newDb.run(
              `CREATE TABLE reflection_answers (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id INTEGER,
              question_id INTEGER,
              question TEXT,
              answer TEXT,
              language TEXT DEFAULT 'en',
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY(user_id) REFERENCES users(id)
            )`,
              (err) => (err ? rej(err) : res())
            );
          });

                    await fs.chmod(dbPath, 0o666);

                    db = newDb;
          console.log("Database initialized successfully");
          resolve();
        } catch (error) {
          console.error("Error during database initialization:", error);
          reject(error);
        }
      });
    });
  } catch (error) {
    console.error("Database initialization failed:", error);
    throw error;
  }
}

const startServer = async () => {
  try {
    await initializeDatabase();
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
