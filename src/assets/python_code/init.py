import numpy as np
from scipy.spatial.distance import cdist
from text2vec import SentenceModel

sentences = ['如何更换花呗绑定银行卡', '花呗更改绑定银行卡','我爱中国']
model = SentenceModel('shibing624/text2vec-base-chinese')
embeddings = model.encode(sentences)

distances = []

def cosine_similarity(vec1, vec2):
    return np.dot(vec1, vec2) / (np.linalg.norm(vec1) * np.linalg.norm(vec2))

for i, emb in enumerate(embeddings):
    if i< len(embeddings)-1:
        distances.append(
           1 - cosine_similarity(emb, embeddings[i+1])
        )


print(distances)
#

#
# similarity = cosine_similarity(embeddings[0], embeddings[1])
# print("相似度: ", similarity)

# cosine_similarity_matrix = 1 - cdist(embeddings, embeddings, metric='cosine')
#
# print("相似度: ", cosine_similarity_matrix.tolist())