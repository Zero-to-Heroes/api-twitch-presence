export const chunk = <T>(array: readonly T[], size): readonly T[][] =>
	array.reduce((acc, _, i) => {
		if (i % size === 0) {
			acc.push(array.slice(i, i + size));
		}
		return acc;
	}, []);
