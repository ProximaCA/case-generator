# Clinical Case Generator

A multi-agent system for generating realistic clinical case studies for training purposes. The system uses a series of specialized agents to process client information and generate comprehensive case studies with cognitive-behavioral therapy (CBT) elements.

## System Architecture

The system consists of four main agents:

1. **Preprocessing Agent**: Structures raw client input data
2. **Case Generator Agent**: Enriches the case with cognitive patterns and consequences
3. **Narrative Agent**: Creates a cohesive first-person narrative
4. **Final Review Agent**: Combines all outputs into a final case study

## Features

- Web-based interface for data input
- Step-by-step case generation process
- JSON-based data structure
- Real-time processing and display
- CBT-focused case formulation

## Installation

IMPORTANT: Server for 'intermediate' case generator work on 3001 port, base case generator work on 3000 port. 

1. Clone the repository and go to the backend folder:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   pnpm install
   ```
3. Create a `.env` file in the root directory with your OpenAI API key:
   ```
   ANTHROPIC_API_KEY=your_api_key_here
   ```

## Usage

1. Start the server:
   ```bash
   node server.js (3000 port)
   node case_generator_server.js (3001 port)
   ```

2. Open `frontend/case_generator.html` in your browser

i recomend use httpserver for frontend:
```bash
npx http-server
```

3. Fill in the client information form and submit to generate a case study

## API Endpoints

- POST `/api/preprocess`: Processes raw client data
- POST `/api/generate-case`: Generates enriched case data
- POST `/api/generate-narrative`: Creates narrative description
- POST `/api/finalize-case`: Produces final case study

## Data Structure

### Input Format
```json
{
  "client_profile": {
    "age": 35,
    "gender": "Female",
    "occupation": "Software Engineer"
  },
  "presenting_problem": {
    "symptoms": [
      "persistent sadness",
      "loss of interest",
      "fatigue"
    ],
    "trigger_event": "Recent breakup with a long-term partner"
  }
}
```

### Final Output Format
```json
{
  "client_profile": { ... },
  "presenting_problem": { ... },
  "cognitive_patterns": {
    "automatic_thoughts": [ ... ],
    "core_beliefs": [ ... ]
  },
  "consequences": {
    "emotional": [ ... ],
    "behavioral": [ ... ]
  },
  "client_narrative": "..."
}
```

## Security Considerations

- The system requires an OpenAI API key
- CORS is enabled for local development
- Input validation is performed at multiple stages
- Sensitive clinical data should be handled according to relevant privacy regulations

## Development

The project uses:
- Express.js for the backend
- Anthropic Claude Haiku for text generation
- Bootstrap for the frontend UI
- Vanilla JavaScript for frontend logic

## License

MIT License 