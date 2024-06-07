from typing import List

import numpy as np


def calculate_threshold(slope_changes, factor):
    """
    根据给定的因子计算阈值。

    :param slope_changes: 斜率变化量的数组
    :param factor: 0到1之间的值，用于调节阈值的大小
    :return: 计算出的阈值
    """
    mean_change = np.mean(slope_changes)
    std_change = np.std(slope_changes)
    threshold = mean_change + factor * std_change
    return threshold


def build_node_chunks(sentences: List[str], distances: List[float], threshold_factor: float) -> List[str]:
    chunks = []
    if len(sentences) > 0:
        np_distances = np.array(distances)
        # 计算每个点的斜率
        slopes = np.diff(distances) / 1  # 这里假设每个点的间隔为1
        # 计算斜率变化的绝对值
        slope_changes_abs = np.abs(np.diff(slopes))
        # 计算斜率变化的方向
        slope_changes_sign = np.diff(slopes)
        # 计算连续斜率变化之间的乘积，以确定斜率是否发生了方向变化
        slope_product = slope_changes_sign[:-1] * slope_changes_sign[1:]

        # 找出斜率方向变化的位置（乘积为负）
        sign_changes = np.where(slope_product < 0)[0]

        slope_change_threshold = calculate_threshold(slope_changes_abs, threshold_factor)

        # 找出斜率变化显著且方向发生变化的索引
        significant_slope_changes = sign_changes[
            np.where(slope_changes_abs[sign_changes] > slope_change_threshold)[0]]

        # 斜率变化显著且方向发生变化的索引可能是潜在的语义断点
        potential_breakpoints = significant_slope_changes + 2  # 加2是因为np.diff减少了两个元素

        start_index = 0

        for index in potential_breakpoints:
            group = sentences[start_index: index]
            combined_text = "".join([d for d in group])
            chunks.append(combined_text)

            start_index = index

        if start_index < len(sentences):
            combined_text = "".join(
                [d for d in sentences[start_index:]]
            )
            chunks.append(combined_text)

    else:
        # If, for some reason we didn't get any distances (i.e. very, very small documents) just
        # treat the whole document as a single node
        chunks = [" ".join([s for s in sentences])]

    return chunks
