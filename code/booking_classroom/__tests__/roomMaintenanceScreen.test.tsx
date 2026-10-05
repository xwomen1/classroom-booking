import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { RoleDashboardScreen } from '../src/app';

function textContent(node: ReactTestRenderer.ReactTestInstance): string {
  return node.children
    .map(item => (typeof item === 'string' ? item : textContent(item)))
    .join('');
}

function buttonWithText(
  root: ReactTestRenderer.ReactTestInstance,
  label: string,
) {
  const button = root
    .findAll(item => typeof item.props.onPress === 'function')
    .find(item => textContent(item).includes(label));
  if (!button) throw new Error(`Không tìm thấy nút "${label}".`);
  return button;
}

test('admin manages rooms and maintenance from one floor list', async () => {
  await AsyncStorage.clear();
  let renderer!: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <RoleDashboardScreen
        session={{ username: 'admin', role: 'admin' }}
        onLogout={() => {}}
      />,
    );
  });

  const dashboardText = textContent(renderer.root);
  expect(dashboardText).toContain('Quản lý phòng và bảo trì');
  expect(dashboardText).not.toContain('Lịch phòng và bảo trì');

  await ReactTestRenderer.act(async () => {
    buttonWithText(renderer.root, 'Quản lý phòng và bảo trì').props.onPress();
  });

  const floorScreenText = textContent(renderer.root);
  expect(floorScreenText).toContain('Tầng 1');
  expect(floorScreenText).toContain('Tầng 8');

  await ReactTestRenderer.act(async () => {
    buttonWithText(renderer.root, 'Tầng 1').props.onPress();
  });
  await ReactTestRenderer.act(async () => {
    buttonWithText(renderer.root, '101').props.onPress();
  });

  const selectedRoomText = textContent(renderer.root);
  expect(selectedRoomText).toContain('Sửa phòng');
  expect(selectedRoomText).toContain('Bảo trì');
  expect(selectedRoomText).toContain('Xóa phòng');
  expect(selectedRoomText).toContain('Lịch bảo trì của phòng');
  expect(selectedRoomText).toContain('Lịch sử dụng đã duyệt');
  await ReactTestRenderer.act(async () => {
    renderer.unmount();
  });
}, 30000);
