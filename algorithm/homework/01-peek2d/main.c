/*
 * Copyright (c) 2025, Ding Tao
 */

/*
 * Homework for <Algorithm> lectured by Dr. Xiao in Spring session 2025 at HNU.
 *
 * Author: Ding Tao (Stu.id T202401016)
 *
 * Date: 25th May, 2025
 */

/*
 * Matrix peek finder - Find peek value in a given matrix.
 *
 * Note: Most of the error handlings are ommited in this homework.
 */

#include <stdio.h>
#include <stdlib.h> /* strtol & malloc */
#include <stdbool.h> /* true/false */
#include <time.h> /* For rand() seed */

/*
 * matrix_find_col_max - Find global max value (return by row index) in a given
 *                       column within a matrix
 *
 * @matrix: The matrix to find
 * @row_start: Given lowest row border
 * @row_end: Given highest row border
 * @col: Column to find
 * @row_out: Output row that have the peek value within @col column
 */
static void matrix_find_col_max(unsigned long **matrix,
				size_t row_start,
				size_t row_end,
				size_t col,
				size_t *row_out)
{
	size_t i;
	size_t row_max;
	unsigned long val;

	row_max = row_start;
	val = matrix[row_start][col];

	for (i = row_start + 1; i < row_end; i++) {
		if (matrix[i][col] > matrix[row_max][col]) {
			row_max = i;
			val = matrix[i][col];
		}
	}

	*row_out = row_max;
}

/*
 * matrix_find_peek - Find one peek value (return by row/col index) in a given
 *                    matrix with limited border
 *
 * @matrix: The matrix to find
 * @row_start: Top border of matrix
 * @row_end: Bottom boader of matrix
 * @col_start: Left border of matrix
 * @col_end: Right border of matrix
 * @row_out: Peek value's row to output
 * @col_end: Peek value's col to output
 */
static void matrix_find_peek(unsigned long **matrix,
			     size_t row_start, size_t row_end,
			     size_t col_start, size_t col_end,
			     size_t *row_out, size_t *col_out)
{
	size_t col_mid;
	size_t row_max;

	col_mid = (col_start + col_end) / 2;

	matrix_find_col_max(matrix, row_start, row_end, col_mid, &row_max);

	if ((col_start < col_mid) &&
		(matrix[row_max][col_mid - 1] >= matrix[row_max][col_mid])) {

		/*
		 * We did not reach left border, and left item great than
		 * current max
		 */

		return matrix_find_peek(matrix, row_start, row_end, col_start,
				col_mid, row_out, col_out);

	} else if ((col_mid < col_end) &&
		(matrix[row_max][col_mid] <= matrix[row_max][col_mid + 1])) {
		/*
		 * We did not reach right border, and right item great than
		 * current max
		 */

		return matrix_find_peek(matrix, row_start, row_end, col_mid,
				col_end, row_out, col_out);

	} else {
		*row_out = row_max;
		*col_out = col_mid;
	}
}

/******************************************************************************/

static void matrix_alloc(unsigned long ***matrix_out, size_t row, size_t col)
{
	size_t i;
	unsigned long **matrix;

	matrix = malloc(row * sizeof(*matrix));

	for (i = 0; i < row; i++)
		matrix[i] = malloc(col * sizeof(*matrix[i]));

	*matrix_out = matrix;
}

static void matrix_free(unsigned long **matrix, size_t row)
{
	size_t i;

	for (i = 0; i < row; i++)
		free(matrix[i]);

	free(matrix);
}

static void matrix_fill_random(unsigned long **matrix, size_t row, size_t col)
{
	size_t i, j;

	/* Seed the random generator using clock() */
	srand((unsigned long)clock());

	for (i = 0; i < row; i++)
		for (j = 0; j < col; j++) {
			matrix[i][j] = rand();

			matrix[i][j] %= 1000;
		}
}

static void matrix_print(unsigned long **matrix,
			 size_t row,
			 size_t col,
			 bool is_transpose)
{
	size_t i, j;

	if (is_transpose) {
		row = row ^ col;
		col = row ^ col;
		row = row ^ col;
	}

	/* Skip row index */
	printf("     ");
	/* Print col index */
	for (j = 0; j < col; j++) {
		printf("%3zu ", j);
	}

	/* Skip row index */
	printf("\n     ");
	/* Print delimiter */
	for (j = 0; j < col; j++) {
		printf("----");
	}
	printf("\n");

	for (i = 0; i < row; i++) {
		for (j = 0; j < col; j++) {
			if (j == 0) {
				/* Print row index and delimiter */
				printf("%3zu |", i);
			}

			if (is_transpose) {
				printf("%3lu ", matrix[j][i]);
			} else {
				printf("%3lu ", matrix[i][j]);
			}
		}
		printf("\n");
	}
}

static void help(void)
{
	printf("About:\n"
		"    Finding peek value within 2D matrix\n"
		"Usage:\n"
		"    ./peek row col\n"
	      );
}

/******************************************************************************/

int main(int argc, char *argv[])
{
	int ret;
	char *endptr;
	size_t row, col;
	size_t row_out, col_out;
	bool is_transpose;
	unsigned long **matrix;

	if (argc != 3) {
		help();
		return -1;
	}

	row = strtol(argv[1], &endptr, 0);
	if (*endptr != '\0') {
		printf("Invalid row\n");
		return -1;
	}
	col = strtol(argv[2], &endptr, 0);
	if (*endptr != '\0') {
		printf("Invalid col\n");
		return -1;
	}

	/*
	 * The peek finding algorithm have O(row * log2(col)) complexity, when
	 * (row >> col), we may result in O(row) complexity. Switch row/col to
	 * get O(log2(row)) complexity.
	 */
	if (row > col) {
		row = row ^ col;
		col = row ^ col;
		row = row ^ col;
		/*
		 * Switch two value without need of 3rd temp var.
		 *
		 * Equivalent to:
		 *
		 * temp = row;
		 * row = col;
		 * col = temp;
		 */

		 is_transpose = true;
	} else {
		 is_transpose = false;
	}

	matrix_alloc(&matrix, row, col);
	matrix_fill_random(matrix, row, col);
	matrix_print(matrix, row, col, is_transpose);

	matrix_find_peek(matrix, 0, row - 1, 0, col - 1, &row_out, &col_out);

	if (!is_transpose) {
		printf("Peek posision: (%zu, %zu) value (%lu)\n",
				row_out, col_out, matrix[row_out][col_out]);
	} else {
		printf("Peek posision: (%zu, %zu) value (%lu)\n",
				col_out, row_out, matrix[row_out][col_out]);
	}

	matrix_free(matrix, row);

	return 0;
}
