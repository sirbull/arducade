import { maze } from './maze';
import { states } from './states';
import { petGuide } from './pet';
import { ticTacToe } from './tictactoe';
import { bombGuide } from './bombs';
import { focusPictures } from './shared';
export const COURSES = [maze, states, petGuide, ticTacToe, bombGuide].map(focusPictures);
