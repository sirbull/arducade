import { maze } from './maze';
import { states } from './states';
import { petGuide } from './pet';
import { ticTacToe } from './tictactoe';
import { bombGuide } from './bombs';
import { jumper } from './jumper';
import { auditGuide } from '../audit';
export const COURSES = [maze, states, ticTacToe, bombGuide, petGuide, jumper].map(auditGuide);
