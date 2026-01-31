import { Injectable } from '@nestjs/common';

@Injectable()
export class EloService {
    /**
     * Calculate new ELO ratings for both players
     * @param winnerRating Current ELO of the winner
     * @param loserRating Current ELO of the loser
     * @param winnerGamesPlayed Number of games played by winner
     * @param isRanked Whether this is a ranked challenge match
     * @param isDraw Whether the game was a draw
     * @param isDisputeLoser Whether loser lost a dispute (double penalty)
     * @returns New ratings for both players
     */
    calculateNewRatings(
        winnerRating: number,
        loserRating: number,
        winnerGamesPlayed: number,
        loserGamesPlayed: number,
        isRanked: boolean = false,
        isDraw: boolean = false,
        isDisputeLoser: boolean = false,
    ): { winnerNewRating: number; loserNewRating: number } {
        // Determine K-factor based on game conditions
        const winnerKFactor = this.getKFactor(winnerGamesPlayed, isRanked);
        const loserKFactor = this.getKFactor(loserGamesPlayed, isRanked);

        // Calculate expected scores
        const winnerExpected = this.getExpectedScore(winnerRating, loserRating);
        const loserExpected = this.getExpectedScore(loserRating, winnerRating);

        // Determine actual scores
        let winnerActual = 1;
        let loserActual = 0;

        if (isDraw) {
            winnerActual = 0.5;
            loserActual = 0.5;
        }

        // Calculate rating changes
        let winnerChange = Math.round(winnerKFactor * (winnerActual - winnerExpected));
        let loserChange = Math.round(loserKFactor * (loserActual - loserExpected));

        // Apply double penalty if loser lost a dispute
        if (isDisputeLoser && !isDraw) {
            loserChange = loserChange * 2;
        }

        return {
            winnerNewRating: winnerRating + winnerChange,
            loserNewRating: loserRating + loserChange,
        };
    }

    /**
     * Get K-factor based on game conditions
     * - First 5 games: K = 40 (Calibration)
     * - Normal game: K = 20
     * - Ranked challenge: K = 30
     */
    private getKFactor(gamesPlayed: number, isRanked: boolean): number {
        if (gamesPlayed < 5) {
            return 40; // Calibration phase
        }
        if (isRanked) {
            return 30; // Ranked challenge
        }
        return 20; // Normal game
    }

    /**
     * Calculate expected score using standard ELO formula
     */
    private getExpectedScore(playerRating: number, opponentRating: number): number {
        return 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
    }
}
