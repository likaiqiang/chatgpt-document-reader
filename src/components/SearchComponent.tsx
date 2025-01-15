import React, { useState } from 'react';
import { Box, TextField, Button, Select, MenuItem, InputLabel, FormControl, SelectChangeEvent } from '@mui/material';

export interface IProps {
  onSearch?: (params: {inputValue:string, selectValue: string}) => void;
  onReset?: () => void;
}

const SearchComponent: React.FC<IProps> = (props) => {
  // 定义输入框和下拉框的状态
  const [inputValue, setInputValue] = useState<string>(''); // 输入框的值
  const [selectValue, setSelectValue] = useState<string>('1'); // 下拉框的值

  // 搜索按钮点击逻辑
  const handleSearch = (): void => {
    if(!inputValue) return;
    console.log('Search clicked with:', { inputValue, selectValue });
    props?.onSearch({
      inputValue,
      selectValue,
    })
    // 在这里执行搜索逻辑
  };

  // 输入框的回车键监听
  const handleKeyPress = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Enter') {
      handleSearch();
    }
  };

  const handleSelectChange = (event: SelectChangeEvent<string>): void => {
    setSelectValue(event.target.value);
  };

  const handleReset = (): void => {
    setInputValue('');
    setSelectValue('1');
    console.log('Reset clicked');
    props?.onReset()
  };

  return (
    <Box
      display="flex"
      alignItems="center"
      gap={1} // 控制元素间距
    >
      {/* 输入框 */}
      <TextField
        label="请输入函数名"
        variant="outlined"
        size="small"
        value={inputValue}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInputValue(e.target.value)}
        onKeyPress={handleKeyPress} // 响应回车键
      />

      {/* 下拉框 */}
      <FormControl variant="outlined">
        <InputLabel size="small" id="select-label">深度</InputLabel>
        <Select
          labelId="select-label"
          value={selectValue}
          onChange={handleSelectChange}
          label="Category"
          size={"small"}
        >
          <MenuItem value="1">level 1</MenuItem>
          <MenuItem value="2">level 2</MenuItem>
          <MenuItem value="3">level 3</MenuItem>
        </Select>
      </FormControl>

      {/* 搜索按钮 */}
      <Button
        variant="contained"
        color="primary"
        onClick={handleSearch}
        size="small"
      >
        搜索
      </Button>
      <Button
        variant="outlined"
        color="secondary"
        size="small" // 设置小尺寸
        onClick={handleReset}
        sx={{ whiteSpace: 'nowrap' }}
      >
        还原
      </Button>
    </Box>
  );
};

export default SearchComponent;
