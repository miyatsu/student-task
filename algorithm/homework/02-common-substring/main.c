/*
 * Copyright (c) 2025, Ding Tao
 */

/*
 * Homework for <Algorithm> lectured by Dr. Xiao in Spring session 2025 at HNU.
 *
 * Author: Ding Tao (Stu.id T202401016)
 *
 * Date: 23th Sep, 2025
 */

/*
 * LCS - Find longest common string within two strings (DP approch).
 *
 * Note: We did not privide random generator any more, user should input string
 *       by them own.
 *
 * Note: At least C99 standard is required to compile this program.
 */

#include <stdio.h>
#include <string.h>
#include <stdlib.h>

/*
 * Calculate length and fill dp table
 */
int lcs_length(const char *s1, const char *s2, int **dp, int m, int n)
{
	/* Init dp table */
	for (int i = 0; i <= m; i++) {
		dp[i][0] = 0;
	}
	for (int j = 0; j <= n; j++) {
		dp[0][j] = 0;
	}

	/* Fill dp table */
	for (int i = 1; i <= m; i++) {
		for (int j = 1; j <= n; j++) {
			if (s1[i-1] == s2[j-1]) {
				dp[i][j] = dp[i-1][j-1] + 1;
			} else {
				dp[i][j] = (dp[i-1][j] > dp[i][j-1]) ? dp[i-1][j] : dp[i][j-1];
			}
		}
	}

	return dp[m][n];
}

/* Get lcs seq */
void get_lcs(const char *s1, const char *s2, int **dp, int m, int n, char *lcs)
{
	int i = m, j = n;
	int index = dp[m][n];
	lcs[index] = '\0';

	while (i > 0 && j > 0) {
		/* If matches, then this char is part of lcs */
		if (s1[i-1] == s2[j-1]) {
			lcs[index-1] = s1[i-1];
			i--;
			j--;
			index--;
		} else if (dp[i-1][j] > dp[i][j-1]) {
			i--;
		} else {
			j--;
		}
	}
}

int main(int argc, char *argv[])
{
	char s1[100], s2[100];

	printf("Please input 1st string:");
	/* Flush output to avoid compiler optimization */
	fflush(stdout);
	scanf("%s", s1);

	printf("Please input 2nd string:");
	/* Flush output to avoid compiler optimization */
	fflush(stdout);
	scanf("%s", s2);

	int m = strlen(s1);
	int n = strlen(s2);

	/* Alloc dp table */
	int **dp = (int**)malloc((m+1) * sizeof(int*));
	for (int i = 0; i <= m; i++) {
		dp[i] = (int*)malloc((n+1) * sizeof(int));
	}

	/* Calculate lcs length */
	int length = lcs_length(s1, s2, dp, m, n);
	printf("The length of LCS is: %d\n", length);

	/* When we do have lcs, print it */
	if (length > 0) {
		char *lcs = (char*)malloc((length + 1) * sizeof(char));
		get_lcs(s1, s2, dp, m, n, lcs);
		printf("The comtent of LCS is: %s\n", lcs);
		free(lcs);
	}

	/* Free dp table */
	for (int i = 0; i <= m; i++) {
		free(dp[i]);
	}
	free(dp);

	return 0;
}
