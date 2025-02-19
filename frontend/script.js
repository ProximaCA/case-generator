let selectedDifficulty = "basic";
let currentCaseData = null;
let currentQuizData = null;
let currentQuizStep = 1;
let userAnswers = [];
let currentReflectionData = null;
let currentLanguage = "en";

const QUIZ_STATES = {
  INITIAL: "initial",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
};
const LOADER_STATES = {
  CASE: {
    icon: "📝",
    text: {
      ru: "Генерация кейса...",
      en: "Generating case...",
      es: "Generando caso...",
    },
    subtext: {
      ru: "Создаём уникальную ситуацию",
      en: "Creating a unique situation",
      es: "Creando una situación única",
    },
  },
  QUIZ: {
    icon: "🧠",
    text: {
      ru: "Подготовка вопросов...",
      en: "Preparing questions...",
      es: "Preparando preguntas...",
    },
    subtext: {
      ru: "Анализируем кейс и формируем задания",
      en: "Analyzing case and forming tasks",
      es: "Analizando caso y formando tareas",
    },
  },
  REFLECTION: {
    icon: "💭",
    text: {
      ru: "Подготовка вопросов для рефлексии...",
      en: "Preparing reflection questions...",
      es: "Preparando preguntas de reflexión...",
    },
    subtext: {
      ru: "Это может занять несколько секунд",
      en: "This may take a few seconds",
      es: "Esto puede tomar unos segundos",
    },
  },
  SAVING: {
    icon: "📤",
    text: {
      ru: "Сохранение результатов...",
      en: "Saving results...",
      es: "Guardando resultados...",
    },
    subtext: {
      ru: "Пожалуйста, подождите",
      en: "Please wait",
      es: "Por favor espere",
    },
  },
};
function parseCase(caseText) {
  try {
    const caseData = {
      antecedent: "",
      belief: "",
      consequence: "",
    };

    const patterns = {
      antecedent: {
        ru: /(?:Антецедент|Antecedent):\s*"([^"]+)"/,
        en: /(?:Antecedent):\s*"([^"]+)"/,
        es: /(?:Antecedente):\s*"([^"]+)"/,
      },
      belief: {
        ru: /(?:Убеждение|Belief):\s*"([^"]+)"/,
        en: /(?:Belief):\s*"([^"]+)"/,
        es: /(?:Creencia):\s*"([^"]+)"/,
      },
      consequence: {
        ru: /(?:Следствие|Consequence).*?:\s*"([^"]+)"/,
        en: /(?:Consequence).*?:\s*"([^"]+)"/,
        es: /(?:Consecuencia).*?:\s*"([^"]+)"/,
      },
    };

    const antecedentMatch = caseText.match(
      patterns.antecedent[currentLanguage]
    );
    const beliefMatch = caseText.match(patterns.belief[currentLanguage]);
    const consequenceMatch = caseText.match(
      patterns.consequence[currentLanguage]
    );

    if (!antecedentMatch || !beliefMatch || !consequenceMatch) {
      throw new Error("Не удалось найти все необходимые компоненты кейса");
    }

    caseData.antecedent = antecedentMatch[1].trim();
    caseData.belief = beliefMatch[1].trim();
    caseData.consequence = consequenceMatch[1].trim();

        for (const [key, value] of Object.entries(caseData)) {
      if (!value || value.length < 10) {
        throw new Error(`Некорректное значение для ${key}`);
      }
    }

    return caseData;
  } catch (error) {
    console.error("Ошибка при парсинге кейса:", error);
    throw new Error(`Ошибка обработки кейса: ${error.message}`);
  }
}

function createCaseElement(caseData) {
  const t = translations[currentLanguage];
  return `
    <div class="case-content">
        <div class="case-section">
            <h4>${t.case?.antecedent || "Antecedent"}:</h4>
            <p>"${caseData.antecedent}"</p>
        </div>
        <div class="case-section">
            <h4>${t.case?.belief || "Belief"}:</h4>
            <p>"${caseData.belief}"</p>
        </div>
        <div class="case-section">
            <h4>${t.case?.consequence || "Consequence"}:</h4>
            <p>"${caseData.consequence}"</p>
        </div>
        <div class="case-navigation">
            <button class="regenerate-btn">↻ ${t.case?.regenerate ||
              "Regenerate"}</button>
            <div class="nav-buttons">
                <button class="nav-btn next-btn">${t.quiz?.next ||
                  "Next"} →</button>
            </div>
        </div>
    </div>
  `;
}

async function generateCase(difficulty) {
  try {
    showLoader(LOADER_STATES.CASE);
    const response = await fetch("http://localhost:3000/api/generate-case", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        difficulty,
        language: currentLanguage,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ошибка сервера: ${response.status}`);
    }

    const data = await response.json();

    if (!data.case || typeof data.case !== "string") {
      throw new Error("Некорректный ответ от сервера");
    }

    return parseCase(data.case);
  } catch (error) {
    console.error("Ошибка при генерации кейса:", error);
    throw new Error(`Не удалось сгенерировать кейс: ${error.message}`);
  } finally {
    hideLoader();
  }
}

function createSimplifiedCaseElement(caseData) {
  return `
    <div class="case-content simplified">
        <div class="case-section">
            <h4>Antecedent (Триггер):</h4>
            <p>${caseData.antecedent}</p>
        </div>
        <div class="case-section">
            <h4>Belief (Убедение):</h4>
            <p>${caseData.belief}</p>
        </div>
        <div class="case-section">
            <h4>Consequence (Эмоциональная реакция):</h4>
            <p>${caseData.consequence}</p>
        </div>
    </div>
  `;
}

document.addEventListener("DOMContentLoaded", () => {
  const previewSection = document.querySelector(".preview-section");
  const generateBtn = document.getElementById("generateBtn");
  const loader = document.getElementById("loader");

  const difficultyBtns = document.querySelectorAll(".difficulty-btn");
  difficultyBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      difficultyBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      selectedDifficulty = btn.dataset.difficulty;
    });
  });

    generateBtn.addEventListener("click", async () => {
    previewSection.style.display = "none";
    loader.style.display = "flex";
    hideLanguageSelector(); 
    try {
      const result = await generateCase(selectedDifficulty);
      currentCaseData = result;
      const caseHtml = createCaseElement(currentCaseData);

      const container = document.querySelector(".container");
      const caseElement = document.createElement("div");
      caseElement.className = "case-result";
      caseElement.innerHTML = caseHtml;

            const oldCaseResult = document.querySelector(".case-result");
      if (oldCaseResult) {
        oldCaseResult.remove();
      }

      loader.style.display = "none";
      container.appendChild(caseElement);

            setupButtonHandlers(currentCaseData);
    } catch (error) {
      loader.style.display = "none";
      alert(error.message);
      previewSection.style.display = "block";
      showLanguageSelector();     }
  });
});
function createCaseNote(caseData) {
  const t = translations[currentLanguage];
  return `
    <div class="case-note">
        <div class="case-note-header">
            <h4>${t.case?.currentCase || "Current Case"}:</h4>
        </div>
        <div class="case-note-content">
            <div class="case-item">
                <span class="label">${t.case?.antecedent ||
                  "Antecedent"}:</span>
                <p>${caseData.antecedent}</p>
            </div>
            <div class="case-item">
                <span class="label">${t.case?.belief || "Belief"}:</span>
                <p>${caseData.belief}</p>
            </div>
            <div class="case-item">
                <span class="label">${t.case?.consequence ||
                  "Consequence"}:</span>
                <p>${caseData.consequence}</p>
            </div>
        </div>
    </div>
  `;
}
async function generateQuiz(caseData) {
  try {
    const response = await fetch("http://localhost:3000/api/generate-quiz", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        case: caseData,
        language: currentLanguage,       }),
    });

    if (!response.ok) {
      throw new Error(`Ошибка сервера: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Ошибка при генерации квиза:", error);
    throw new Error(`Не удалось сгенерировать квиз: ${error.message}`);
  }
}

function parseQuizOption(optionText) {
    const cleanText = optionText.split("\n")[0].trim();
    return cleanText.replace(/\*\*/g, "");
}

function displayQuiz(quizData) {
  const t = translations[currentLanguage];
  const quizSection = document.getElementById("quizSection");
  const quizContent = quizSection.querySelector(".quiz-content");
  const loader = document.getElementById("loader");

  try {
        if (
      !quizData ||
      !quizData.questions ||
      !Array.isArray(quizData.questions)
    ) {
      throw new Error("Некорректная структура данных квиза");
    }

    const currentQuestion = quizData.questions[currentQuizStep - 1];
    if (!currentQuestion) {
      throw new Error("Не удалось получить текущий вопрос");
    }

    loader.style.display = "none";
    quizContent.innerHTML = `
      <div class="case-note-container">
        ${createCaseNote(currentCaseData)}
      </div>
      <h3 class="quiz-question">${currentQuestion.question}</h3>
      <div class="quiz-options">
        ${currentQuestion.options
          .map(
            (option) => `
          <label class="quiz-option">
            <input type="radio" name="quiz-answer" value="${option.value}">
            <span class="option-text">${parseQuizOption(option.text)}</span>
          </label>
        `
          )
          .join("")}
      </div>
      <div class="explanation-box hidden"></div>
      <div class="quiz-navigation">
        <span class="step-counter">${t.quiz.step}: ${currentQuizStep}/${
      quizData.totalQuestions
    }</span>
        <div class="nav-buttons">
          <button class="nav-btn next-btn" disabled>${t.quiz.next} →</button>
        </div>
      </div>
    `;

        setupQuizHandlers(currentQuestion);
  } catch (error) {
    console.error("Ошибка при отображении квиза:", error);
    loader.style.display = "none";
    alert(error.message);
  }
}

function setupQuizHandlers(currentQuestion) {
  const quizContent = document.querySelector(".quiz-content");
  const radioButtons = quizContent.querySelectorAll('input[type="radio"]');
  const nextBtn = quizContent.querySelector(".next-btn");
  const explanationBox = quizContent.querySelector(".explanation-box");

  radioButtons.forEach((radio) => {
    radio.addEventListener("change", () => {
      nextBtn.disabled = false;

            userAnswers[currentQuizStep - 1] = radio.value;

            const selectedOption = radio.value;
      const correctAnswer = currentQuestion.correctAnswer;

            radioButtons.forEach((rb) => {
        const optionLabel = rb.closest(".quiz-option");
        if (rb.value === correctAnswer) {
          optionLabel.classList.add("correct");
        } else if (rb.value === selectedOption) {
          optionLabel.classList.add("incorrect");
        }
        rb.disabled = true;
      });

            explanationBox.innerHTML = `<p>${currentQuestion.explanation}</p>`;
      explanationBox.classList.remove("hidden");
    });
  });

    nextBtn.addEventListener("click", () => {
    if (currentQuizStep < currentQuizData.totalQuestions) {
      currentQuizStep++;
      displayQuiz(currentQuizData);
    } else {
      handleQuizCompletion();
    }
  });
}

async function initQuiz(caseData) {
  const quizSection = document.getElementById("quizSection");
  const caseResult = document.querySelector(".case-result");

  try {
    showLoader({
      icon: "🧠",
      text: {
        ru: "Подготовка вопросов...",
        en: "Preparing questions...",
        es: "Preparando preguntas...",
      },
      subtext: {
        ru: "Анализируем кейс и формируем задания",
        en: "Analyzing case and forming tasks",
        es: "Analizando caso y formando tareas",
      },
    });

    currentQuizData = await generateQuiz(caseData);
    currentQuizStep = 1;
    userAnswers = [];

    caseResult.classList.add("hidden");
    quizSection.classList.remove("hidden");
    displayQuiz(currentQuizData);
  } catch (error) {
    console.error("Ошибка при инициализации квиза:", error);
    throw error;
  } finally {
    hideLoader();
  }
}
function handleNextQuestion() {
  if (currentQuizStep < currentQuizData.totalQuestions) {
    currentQuizStep++;
    const currentQuestion = currentQuizData.questions[currentQuizStep - 1];
    displayQuiz({
      question: currentQuestion.question,
      options: currentQuestion.options,
      currentStep: currentQuizStep,
      totalSteps: currentQuizData.totalQuestions,
    });
  } else {
    handleQuizCompletion();
  }
}

function setupButtonHandlers(caseData) {
  const nextBtn = document.querySelector(".next-btn");
  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      handleNextStep();
    });
  }

    const regenerateBtn = document.querySelector(".regenerate-btn");
  if (regenerateBtn) {
    regenerateBtn.addEventListener("click", async () => {
      const caseResult = document.querySelector(".case-result");
      const quizSection = document.getElementById("quizSection");
      const loader = document.getElementById("loader");

            const oldNoteContainer = quizSection.querySelector(
        ".case-note-container"
      );
      if (oldNoteContainer) {
        oldNoteContainer.remove();
      }

      caseResult.classList.add("hidden");
      quizSection.classList.add("hidden");
      loader.style.display = "flex";

      try {
        const newResult = await generateCase(selectedDifficulty);
        currentCaseData = newResult;
        caseResult.innerHTML = createCaseElement(currentCaseData);
        caseResult.classList.remove("hidden");

                setupButtonHandlers(currentCaseData);
      } catch (error) {
        alert(error.message);
      }
      loader.style.display = "none";
    });
  }
}
function createQuizResultWindow(score, total) {
  const t = translations[currentLanguage];
  const percentage = (score / total) * 100;
  let emoji, message;

  if (percentage === 100) {
    emoji = "🏆";
    message = t.quiz.results.perfect;
  } else if (percentage >= 80) {
    emoji = "🌟";
    message = t.quiz.results.great;
  } else if (percentage >= 60) {
    emoji = "👍";
    message = t.quiz.results.good;
  } else {
    emoji = "💪";
    message = t.quiz.results.motivate;
  }

  return `
    <div class="quiz-result">
      <div class="result-header">
        <span class="result-emoji">${emoji}</span>
        <h3>${t.quiz.results.title}</h3>
      </div>
      <div class="score-container">
        <div class="score-circle">
          <span class="score-number">${score}/${total}</span>
          <span class="score-label">${t.quiz.results.points}</span>
        </div>
      </div>
      <div class="result-message">
        ${message}
      </div>
      <div class="result-actions">
        <button class="result-btn home-btn">
          <span class="btn-icon">🏠</span>
          ${t.quiz.home}
        </button>
        <button class="result-btn retry-btn">
          <span class="btn-icon">🔄</span>
          ${t.quiz.tryAgain}
        </button>
      </div>
    </div>
  `;
}

function handleQuizCompletion() {
  const quizSection = document.getElementById("quizSection");
  const score = calculateScore();

    quizSection.innerHTML = createQuizResultWindow(
    score,
    currentQuizData.totalQuestions
  );

    const homeBtn = quizSection.querySelector(".home-btn");
  const retryBtn = quizSection.querySelector(".retry-btn");
  const continueBtn = document.createElement("button");

  continueBtn.className = "result-btn continue-btn";
  continueBtn.innerHTML = `
    <span class="btn-icon">➡️</span>
    ${translations[currentLanguage].quiz.continue}
  `;

    const resultActions = quizSection.querySelector(".result-actions");
  resultActions.appendChild(continueBtn);

  homeBtn.addEventListener("click", () => {
    location.reload();
  });

  retryBtn.addEventListener("click", () => {
    quizSection.innerHTML = '<div class="quiz-content"></div>';
    currentQuizStep = 1;
    userAnswers = [];
    displayQuiz(currentQuizData);
  });

  continueBtn.addEventListener("click", async () => {
    try {
      showLoader(LOADER_STATES.REFLECTION);

      currentReflectionData = await generateReflection(currentCaseData);
      quizSection.classList.add("hidden");
      const reflectionSection = document.getElementById("reflectionSection");
      reflectionSection.classList.remove("hidden");
      displayReflection(currentReflectionData);
    } catch (error) {
      alert(error.message);
    } finally {
      hideLoader();
    }
  });
}

function calculateScore() {
  return userAnswers.filter(
    (answer, index) => answer === currentQuizData.questions[index].correctAnswer
  ).length;
}
function showLoader(state = LOADER_STATES.CASE) {
  const loader = document.getElementById("loader");
  const icon = loader.querySelector(".loader-icon");
  const text = loader.querySelector(".loader-text");
  const subtext = loader.querySelector(".loader-subtext");

  icon.textContent = state.icon;
  text.textContent = state.text[currentLanguage];
  subtext.textContent = state.subtext[currentLanguage];

  loader.style.display = "flex";
}

function hideLoader() {
  const loader = document.getElementById("loader");
  loader.style.display = "none";
}

async function handleNextStep() {
  const caseResult = document.querySelector(".case-result");
  const quizSection = document.getElementById("quizSection");

  showLoader({
    icon: "🧠",
    text: {
      ru: "Подготовка вопросов...",
      en: "Preparing questions...",
      es: "Preparando preguntas...",
    },
    subtext: {
      ru: "Анализируем кейс и формируем задания",
      en: "Analyzing case and forming tasks",
      es: "Analizando caso y formando tareas",
    },
  });

  try {
    await initQuiz(currentCaseData);
    caseResult.classList.add("hidden");
    quizSection.classList.remove("hidden");
  } catch (error) {
    console.error("Ошибка при инициализации квиза:", error);
    alert(error.message);
  } finally {
    hideLoader();
  }
}

async function generateReflection(caseData) {
  try {
    const response = await fetch(
      "http://localhost:3000/api/generate-reflection",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          case: caseData,
          language: currentLanguage,         }),
      }
    );

    if (!response.ok) {
      throw new Error(`Ошибка сервера: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Ошибка при генерации рефлексивных вопросов:", error);
    throw error;
  }
}
function displayReflection(reflectionData) {
  const t = translations[currentLanguage];
  const reflectionSection = document.getElementById("reflectionSection");
  const reflectionContent = reflectionSection.querySelector(
    ".reflection-content"
  );

  reflectionContent.innerHTML = `
    <div class="case-note-container">
      ${createCaseNote(currentCaseData)}
    </div>
    ${reflectionData.questions
      .map(
        (q, index) => `
      <div class="reflection-question">
        <h4>${t.reflection.question} ${index + 1}</h4>
        <p>${q.question}</p>
        <textarea class="reflection-textarea" placeholder="${
          t.reflection.placeholder
        }"></textarea>
        ${
          q.hint
            ? `<div class="reflection-hint">💡 ${t.reflection.hint}: ${q.hint}</div>`
            : ""
        }
      </div>
    `
      )
      .join("")}
    <div class="reflection-navigation">
      <button class="nav-btn back-btn">← ${t.reflection.back}</button>
      <button class="nav-btn next-btn">${t.reflection.finish}</button>
    </div>
  `;

    setupReflectionHandlers();
}

function setupReflectionHandlers() {
  const reflectionSection = document.getElementById("reflectionSection");
  const backBtn = reflectionSection.querySelector(".back-btn");
  const nextBtn = reflectionSection.querySelector(".next-btn");

  backBtn.addEventListener("click", () => {
    reflectionSection.classList.add("hidden");
    document.getElementById("quizSection").classList.remove("hidden");
  });

  nextBtn.addEventListener("click", async () => {
        const reflectionAnswers = Array.from(
      reflectionSection.querySelectorAll(".reflection-textarea")
    ).map((textarea, index) => ({
      questionId: index + 1,
      answer: textarea.value.trim(),
    }));

        reflectionSection.innerHTML = createFeedbackForm();
    setupFeedbackHandlers(reflectionAnswers);
  });
}
function setupFeedbackHandlers(reflectionAnswers) {
  const form = document.querySelector(".feedback-form");
  const scoreBlocks = form.querySelectorAll(".score-block");
  const scoreValue = form.querySelector(".score-value");
  let selectedScore = 5;

    scoreBlocks.forEach((block) => {
    block.addEventListener("click", () => {
      selectedScore = parseInt(block.dataset.value);
      scoreValue.textContent = selectedScore;

            scoreBlocks.forEach((b) => {
        if (parseInt(b.dataset.value) <= selectedScore) {
          b.classList.add("active");
        } else {
          b.classList.remove("active");
        }
      });
    });
  });

    form.querySelector(".submit-btn").addEventListener("click", async () => {
    const name = form.querySelector("#name").value.trim();
    const email = form.querySelector("#email").value.trim();

    if (!name) {
      alert(
        translations[currentLanguage].feedback.nameRequired ||
          "Please enter your name"
      );
      return;
    }

    try {
      showLoader(LOADER_STATES.SAVING);

      const response = await fetch("http://localhost:3000/api/save-results", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          email,
          score: selectedScore,
          reflectionAnswers,
          caseData: currentCaseData,
          quizAnswers: userAnswers,
          language: currentLanguage,         }),
      });

      if (!response.ok) {
        throw new Error(
          translations[currentLanguage].feedback.saveError ||
            "Error saving results"
        );
      }

      const t = translations[currentLanguage];
            form.innerHTML = `
        <div style="text-align: center; padding: 40px;">
          <h3>${t.feedback.success.title}</h3>
          <p>${t.feedback.success.message}</p>
          <button class="nav-btn home-btn" onclick="location.reload()">
            ${t.feedback.success.home}
          </button>
        </div>
      `;
    } catch (error) {
      alert(
        translations[currentLanguage].feedback.saveError ||
          "Error saving results"
      );
      console.error(error);
    } finally {
      hideLoader();
    }
  });
}

function createFeedbackForm() {
  const t = translations[currentLanguage];
  return `
    <div class="feedback-form">
      <h3>${t.feedback.title}</h3>
      <div class="form-group">
        <label for="name">${t.feedback.nameLabel}</label>
        <input type="text" id="name" class="form-input" required>
      </div>
      <div class="form-group">
        <label for="email">${t.feedback.emailLabel}</label>
        <input type="email" id="email" class="form-input">
      </div>
      <div class="form-group">
        <label>${t.feedback.rateLabel}</label>
        <div class="score-slider-container">
          <div class="score-slider">
            ${Array.from({ length: 10 }, (_, i) => i + 1)
              .map(
                (num) => `
                <div class="score-block" 
                     data-value="${num}" 
                     style="background: ${getScoreGradient(num)}">
                </div>
              `
              )
              .join("")}
          </div>
          <div class="score-value">5</div>
        </div>
      </div>
      <button class="submit-btn">${t.feedback.submit}</button>
    </div>
  `;
}
function getScoreGradient(score) {
  const red = Math.max(0, (255 * (10 - score)) / 5);
  const green = Math.max(0, (255 * score) / 5);
  return `rgb(${red}, ${green}, 0)`;
}

function changeLanguage(lang) {
  currentLanguage = lang;
  updateInterface();
}

function updateInterface() {
  const t = translations[currentLanguage];

    document.querySelector("h1").textContent = t.title;
  document.querySelector(".description").textContent = t.description;
  document.querySelector(".difficulty-selector h3").textContent =
    t.selectDifficulty;

    document
    .querySelectorAll(".difficulty-btn .difficulty-name")
    .forEach((btn) => {
      const difficulty = btn.closest(".difficulty-btn").dataset.difficulty;
      btn.textContent = t.difficulties[difficulty];
    });

    document.querySelector("#generateBtn").textContent = t.generateBtn;

    const elements = {
    ".loader-text": t.loading?.case?.text,
    ".loader-subtext": t.loading?.case?.subtext,
    ".next-btn": t.quiz?.next,
    ".back-btn": t.reflection?.back,
    ".try-again-btn": t.quiz?.tryAgain,
    ".home-btn": t.quiz?.home,
    ".continue-btn": t.quiz?.continue,
  };

  for (const [selector, text] of Object.entries(elements)) {
    const element = document.querySelector(selector);
    if (element && text) {
      element.textContent = text;
    }
  }
}
document.addEventListener("DOMContentLoaded", () => {
  const langSelect = document.getElementById("langSelect");

    currentLanguage = "en";
  langSelect.value = currentLanguage;

  langSelect.addEventListener("change", (e) => {
    changeLanguage(e.target.value);
  });

    updateInterface();
});

function parseQuizOption(optionText) {
    const cleanText = optionText.split("\n")[0].trim();
    return cleanText.replace(/\*\*/g, "");
}

function parseReflectionQuestion(questionText) {
    return questionText.replace(/^\d+\.\s*/, "").trim();
}
function parseCase(caseText) {
  try {
    const caseData = {
      antecedent: "",
      belief: "",
      consequence: "",
    };

        const patterns = {
      antecedent: {
        ru: /(?:Антецедент|Antecedent):\s*"([^"]+)"/,
        en: /(?:Antecedent):\s*"([^"]+)"/,
        es: /(?:Antecedente):\s*"([^"]+)"/,
      },
      belief: {
        ru: /(?:Убеждение|Belief):\s*"([^"]+)"/,
        en: /(?:Belief):\s*"([^"]+)"/,
        es: /(?:Creencia):\s*"([^"]+)"/,
      },
      consequence: {
        ru: /(?:Следствие|Consequence).*?:\s*"([^"]+)"/,
        en: /(?:Consequence).*?:\s*"([^"]+)"/,
        es: /(?:Consecuencia).*?:\s*"([^"]+)"/,
      },
    };

    const antecedentMatch = caseText.match(
      patterns.antecedent[currentLanguage]
    );
    const beliefMatch = caseText.match(patterns.belief[currentLanguage]);
    const consequenceMatch = caseText.match(
      patterns.consequence[currentLanguage]
    );

    if (!antecedentMatch || !beliefMatch || !consequenceMatch) {
      throw new Error("Не удалось найти все необходимые компоненты кейса");
    }

    caseData.antecedent = antecedentMatch[1].trim();
    caseData.belief = beliefMatch[1].trim();
    caseData.consequence = consequenceMatch[1].trim();

        for (const [key, value] of Object.entries(caseData)) {
      if (!value || value.length < 10) {
        throw new Error(`Некорректное значение для ${key}`);
      }
    }

    return caseData;
  } catch (error) {
    console.error("Ошибка при парсинге кейса:", error);
    throw new Error(`Ошибка обработки кейса: ${error.message}`);
  }
}
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

function hideLanguageSelector() {
  const langSelector = document.querySelector(".language-selector");
  if (langSelector) {
    langSelector.style.display = "none";
  }
}

function showLanguageSelector() {
  const langSelector = document.querySelector(".language-selector");
  if (langSelector) {
    langSelector.style.display = "block";
  }
}

generateBtn.addEventListener("click", async () => {
  previewSection.style.display = "none";
  loader.style.display = "flex";
  hideLanguageSelector(); 
  try {
    const result = await generateCase(selectedDifficulty);
    currentCaseData = result;
    const caseHtml = createCaseElement(currentCaseData);

    const container = document.querySelector(".container");
    const caseElement = document.createElement("div");
    caseElement.className = "case-result";
    caseElement.innerHTML = caseHtml;

        const oldCaseResult = document.querySelector(".case-result");
    if (oldCaseResult) {
      oldCaseResult.remove();
    }

    loader.style.display = "none";
    container.appendChild(caseElement);

        setupButtonHandlers(currentCaseData);
  } catch (error) {
    loader.style.display = "none";
    alert(error.message);
    previewSection.style.display = "block";
    showLanguageSelector();   }
});

function returnToHome() {
  location.reload(); }

function returnToHome() {
    document.querySelector(".case-result").classList.add("hidden");
  document.getElementById("quizSection").classList.add("hidden");
  document.getElementById("reflectionSection").classList.add("hidden");

    document.querySelector(".preview-section").style.display = "block";

    showLanguageSelector();

    currentCaseData = null;
  currentQuizData = null;
  currentQuizStep = 1;
  userAnswers = [];
  currentReflectionData = null;
}

function updateHomeButtons() {
  document.querySelectorAll(".home-btn").forEach((btn) => {
    btn.addEventListener("click", returnToHome);
  });
}
