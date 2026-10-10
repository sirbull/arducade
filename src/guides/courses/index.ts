import { maze } from './maze';
import { states } from './states';
import { petGuide } from './pet';
import { ticTacToe } from './tictactoe';
import { bombGuide } from './bombs';
import { jumper } from './jumper';
import { focusPictures } from './shared';
export const COURSES = [maze, states, ticTacToe, bombGuide, petGuide, jumper].map(focusPictures);
