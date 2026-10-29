// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach,expect,it,vi} from 'vitest';
import {FridgeSwitcher} from './fridge-switcher';
const fridges=[{id:'owned',name:'우리집',role:'owner' as const},{id:'shared',name:'함께 냉장고',role:'member' as const}];
afterEach(cleanup);
it('selected_name_and_role_are_inside_the_trigger_as_separate_badge',()=>{
 render(<FridgeSwitcher fridges={fridges} selectedId="owned" onSelect={()=>{}}/>);const trigger=screen.getByRole('combobox',{name:'냉장고 선택'});expect(within(trigger).getByText('우리집')).toBeVisible();expect(within(trigger).getByText('내 소유')).toHaveClass('fridge-role-badge');fireEvent.click(trigger);expect(screen.getByRole('option',{name:'함께 냉장고 · 함께 관리'})).toBeVisible();
});
it('keyboard_selection_escape_and_disabled_state_preserve_focus_and_value',async()=>{
 const user=userEvent.setup(),select=vi.fn(),view=render(<FridgeSwitcher fridges={fridges} selectedId="owned" onSelect={select}/>);const trigger=screen.getByRole('combobox',{name:'냉장고 선택'});await user.click(trigger);await user.keyboard('{ArrowDown}{Enter}');expect(select).toHaveBeenCalledWith('shared');expect(screen.queryByRole('listbox')).not.toBeInTheDocument();expect(trigger).toHaveFocus();select.mockClear();await user.click(trigger);await user.keyboard('{ArrowDown}{Escape}');expect(select).not.toHaveBeenCalled();expect(trigger).toHaveFocus();view.rerender(<FridgeSwitcher fridges={fridges} selectedId="owned" onSelect={select} disabled/>);expect(trigger).toBeDisabled();
});
