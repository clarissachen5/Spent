# Spent
A Predictive Spending Budgeting App

**Technical Architechture:**


Mobile Client (Expo + React Native + TypeScript) -> API Layer (FastAPI - Python) -> AI Service Layer (Ollama Llama 3B) -> Database Layer (Firebase - PostgreSQL)


**Technical dependancies installed for spent-frontend:**

npx expo install @react-navigation/native

npx expo install react-native-screens react-native-safe-area-context

npx expo install react-native-gesture-handler react-native-reanimated

npm install @react-navigation/native-stack

npx expo install expo-location

npx expo install expo-auth-session expo-web-browser

**Risks Identified**
- Received feedback from instructors that bank integrations will be difficult to get approved for app store deployment so adjusted to location tracking
- AI API calls can be expensive in runtime and money. We will compute the math we can manually on the backend to minimize calls to the AI.

