import { orange } from '@ant-design/colors';
import { WarningOutlined } from '@ant-design/icons';
import { Input, Popover, Select, Typography } from 'antd';
import query from 'api/dashboard/variables/query';
import { REACT_QUERY_KEY } from 'constants/reactQueryKeys';
import useDebounce from 'hooks/useDebounce';
import { commaValuesParser } from 'lib/dashbaordVariables/customCommaValuesParser';
import sortValues from 'lib/dashbaordVariables/sortVariableValues';
import map from 'lodash-es/map';
import { memo, useEffect, useMemo, useState } from 'react';
import { useQuery } from 'react-query';
import { IDashboardVariable } from 'types/api/dashboard/getAll';
import { VariableResponseProps } from 'types/api/dashboard/variables/query';

import { variablePropsToPayloadVariables } from '../utils';
import {
	SelectItemStyle,
	VariableContainer,
	VariableName,
	VariableValue,
} from './styles';
import { areArraysEqual } from './util';

const ALL_SELECT_VALUE = '__ALL__';

const variableRegexPattern = /\{\{\s*?\.([^\s}]+)\s*?\}\}/g;

interface VariableItemProps {
	variableData: IDashboardVariable;
	existingVariables: Record<string, IDashboardVariable>;
	onValueUpdate: (
		name: string,
		arg1: IDashboardVariable['selectedValue'],
	) => void;
	onAllSelectedUpdate: (name: string, arg1: boolean) => void;
}

const getSelectValue = (
	selectedValue: IDashboardVariable['selectedValue'],
): string | string[] => {
	if (Array.isArray(selectedValue)) {
		return selectedValue.map((item) => item.toString());
	}
	return selectedValue?.toString() || '';
};

function VariableItem({
	variableData,
	existingVariables,
	onValueUpdate,
	onAllSelectedUpdate,
}: VariableItemProps): JSX.Element {
	const [optionsData, setOptionsData] = useState<(string | number | boolean)[]>(
		[],
	);

	const [variableValue, setVaribleValue] = useState(
		variableData?.selectedValue?.toString() || '',
	);

	const debouncedVariableValue = useDebounce(variableValue, 500);

	const [errorMessage, setErrorMessage] = useState<null | string>(null);

	useEffect(() => {
		const { selectedValue } = variableData;

		if (selectedValue) {
			setVaribleValue(selectedValue?.toString());
		}

		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [variableData]);

	const getDependentVariables = (queryValue: string): string[] => {
		const matches = queryValue.match(variableRegexPattern);

		// Extract variable names from the matches array without {{ . }}
		return matches
			? matches.map((match) => match.replace(variableRegexPattern, '$1'))
			: [];
	};

	const getQueryKey = (variableData: any): string[] => {
		let dependentVariablesStr = '';

		const dependentVariables = getDependentVariables(variableData.queryValue);

		dependentVariables?.forEach((element) => {
			dependentVariablesStr += `${element}${existingVariables[element]?.selectedValue}`;
		});

		const variableKey = dependentVariablesStr.replace(/\s/g, '');

		return [REACT_QUERY_KEY.DASHBOARD_BY_ID, variableData.name, variableKey];
	};

	// /* eslint-disable sonarjs/cognitive-complexity */
	const getOptions = (variablesRes: VariableResponseProps | null): void => {
		if (variablesRes && variableData.type === 'QUERY') {
			try {
				setErrorMessage(null);

				if (
					variablesRes?.variableValues &&
					Array.isArray(variablesRes?.variableValues)
				) {
					const newOptionsData = sortValues(
						variablesRes?.variableValues,
						variableData.sort,
					);

					const oldOptionsData = sortValues(optionsData, variableData.sort) as never;

					if (!areArraysEqual(newOptionsData, oldOptionsData)) {
						setOptionsData(newOptionsData);
					}
				}
			} catch (e) {
				console.error(e);
			}
		} else if (variableData.type === 'CUSTOM') {
			setOptionsData(
				sortValues(
					commaValuesParser(variableData.customValue || ''),
					variableData.sort,
				) as never,
			);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	};

	const { isLoading } = useQuery(getQueryKey(variableData), {
		enabled: variableData.type === 'QUERY',
		queryFn: () =>
			query({
				query: variableData.queryValue || '',
				variables: variablePropsToPayloadVariables(existingVariables),
			}),
		refetchOnWindowFocus: false,
		onSuccess: (response) => {
			getOptions(response.payload);
		},
		onError: () => {
			setErrorMessage(
				'Please make sure query is valid and dependent variables are selected',
			);
		},
	});

	const handleChange = (value: string | string[]): void => {
		if (variableData.name)
			if (
				value === ALL_SELECT_VALUE ||
				(Array.isArray(value) && value.includes(ALL_SELECT_VALUE)) ||
				(Array.isArray(value) && value.length === 0)
			) {
				onValueUpdate(variableData.name, optionsData);

				if (!variableData.allSelected) {
					onAllSelectedUpdate(variableData.name, true);
				}
			} else {
				onValueUpdate(variableData.name, value);
				if (variableData.allSelected) {
					onAllSelectedUpdate(variableData.name, false);
				}
			}
	};

	const { selectedValue } = variableData;
	const selectedValueStringified = useMemo(() => getSelectValue(selectedValue), [
		selectedValue,
	]);

	const selectValue = variableData.allSelected
		? 'ALL'
		: selectedValueStringified;

	const mode =
		variableData.multiSelect && !variableData.allSelected
			? 'multiple'
			: undefined;
	const enableSelectAll = variableData.multiSelect && variableData.showALLOption;

	useEffect(() => {
		if (debouncedVariableValue !== variableData?.selectedValue?.toString()) {
			handleChange(debouncedVariableValue);
		}

		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [debouncedVariableValue]);

	return (
		<VariableContainer>
			<VariableName>${variableData.name}</VariableName>
			<VariableValue>
				{variableData.type === 'TEXTBOX' ? (
					<Input
						placeholder="Enter value"
						bordered={false}
						value={variableValue}
						onChange={(e): void => {
							setVaribleValue(e.target.value || '');
						}}
						style={{
							width:
								50 + ((variableData.selectedValue?.toString()?.length || 0) * 7 || 50),
						}}
					/>
				) : (
					!errorMessage &&
					optionsData && (
						<Select
							value={selectValue}
							onChange={handleChange}
							bordered={false}
							placeholder="Select value"
							mode={mode}
							dropdownMatchSelectWidth={false}
							style={SelectItemStyle}
							loading={isLoading}
							showArrow
							showSearch
							data-testid="variable-select"
						>
							{enableSelectAll && (
								<Select.Option data-testid="option-ALL" value={ALL_SELECT_VALUE}>
									ALL
								</Select.Option>
							)}
							{map(optionsData, (option) => (
								<Select.Option
									data-testid={`option-${option}`}
									key={option.toString()}
									value={option}
								>
									{option.toString()}
								</Select.Option>
							))}
						</Select>
					)
				)}
				{errorMessage && (
					<span style={{ margin: '0 0.5rem' }}>
						<Popover
							placement="top"
							content={<Typography>{errorMessage}</Typography>}
						>
							<WarningOutlined style={{ color: orange[5] }} />
						</Popover>
					</span>
				)}
			</VariableValue>
		</VariableContainer>
	);
}

export default memo(VariableItem);
