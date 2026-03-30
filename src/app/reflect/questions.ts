export const REFLECTION_QUESTIONS = [
  { id: 'q_trajectory', text: 'Is the trajectory of your most important goal space changing? Why?' },
  { id: 'q_surprises', text: 'What surprised you most since the last reflection?' },
  { id: 'q_stop_change', text: 'What have you decided to stop, start, or change?' },
  { id: 'q_blind_spots', text: 'Where might you have blind spots right now?' },
  { id: 'q_next_week', text: 'What is the single most important thing to focus on next?' },
] as const;

export type QuestionId = (typeof REFLECTION_QUESTIONS)[number]['id'];
