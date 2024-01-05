import bindings from './binding';
import path from 'path'


const faiss = bindings({
  bindings: 'faiss-node',
  // eslint-disable-next-line
  module_root: MAIN_WINDOW_VITE_DEV_SERVER_URL ? path.join(process.cwd(),'src','assets','node','faiss-node') : path.join(__dirname,'node','faiss-node')
});

faiss.MetricType = void 0;
var MetricType;
(function(MetricType) {
  MetricType[MetricType['METRIC_INNER_PRODUCT'] = 0] = 'METRIC_INNER_PRODUCT';
  MetricType[MetricType['METRIC_L2'] = 1] = 'METRIC_L2';
  MetricType[MetricType['METRIC_L1'] = 2] = 'METRIC_L1';
  MetricType[MetricType['METRIC_Linf'] = 3] = 'METRIC_Linf';
  MetricType[MetricType['METRIC_Lp'] = 4] = 'METRIC_Lp';
  MetricType[MetricType['METRIC_Canberra'] = 20] = 'METRIC_Canberra';
  MetricType[MetricType['METRIC_BrayCurtis'] = 21] = 'METRIC_BrayCurtis';
  MetricType[MetricType['METRIC_JensenShannon'] = 22] = 'METRIC_JensenShannon';
  MetricType[MetricType['METRIC_Jaccard'] = 23] = 'METRIC_Jaccard';
})(MetricType || (faiss.MetricType = MetricType = {}));

export default faiss;
