import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GameHeader } from './game-header';
import { GameStore } from '../../services/game-store';

describe('GameHeader', () => {
  let fixture: ComponentFixture<GameHeader>;
  let gameStore: GameStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [GameHeader],
    });

    fixture = TestBed.createComponent(GameHeader);
    gameStore = TestBed.inject(GameStore);
    fixture.detectChanges();
  });

  it('resets the game on space keydown when the game is won or lost', () => {
    gameStore.newGame({ rows: 1, cols: 2, mines: 1 });
    vi.spyOn(Math, 'random').mockReturnValue(0);

    // Reveal safe cell 0 to win the game
    gameStore.reveal(0);
    expect(gameStore.status()).toBe('won');

    const resetSpy = vi.spyOn(gameStore, 'newGame');
    const cell = document.createElement('div');
    cell.setAttribute('role', 'gridcell');
    document.body.appendChild(cell);

    const event = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
    cell.dispatchEvent(event);

    expect(resetSpy).toHaveBeenCalled();
    document.body.removeChild(cell);
  });

  it('does not reset on space keydown during active play when focused on a gridcell', () => {
    gameStore.newGame({ rows: 2, cols: 2, mines: 1 });

    const resetSpy = vi.spyOn(gameStore, 'newGame');
    const cell = document.createElement('div');
    cell.setAttribute('role', 'gridcell');
    document.body.appendChild(cell);

    const event = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
    cell.dispatchEvent(event);

    expect(resetSpy).not.toHaveBeenCalled();
    document.body.removeChild(cell);
  });
});
