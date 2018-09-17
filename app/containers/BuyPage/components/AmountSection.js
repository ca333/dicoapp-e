// @flow
import React, { Component } from 'react';
import { connect } from 'react-redux';
import { compose } from 'redux';
import type { Dispatch } from 'redux';
import { createStructuredSelector } from 'reselect';
import type { List, Map } from 'immutable';
import { withStyles } from '@material-ui/core/styles';
import SwapHorizIcon from '@material-ui/icons/SwapHoriz';
import Grid from '@material-ui/core/Grid';
import Typography from '@material-ui/core/Typography';
import LinearProgress from '@material-ui/core/LinearProgress';
import Snackbar from '@material-ui/core/Snackbar';
import IconButton from '@material-ui/core/IconButton';
import CloseIcon from '@material-ui/icons/Close';
import { Circle, Line } from '../../../components/placeholder';
import { getCoinIcon } from '../../../components/CryptoIcons';
import { requiredNumber } from '../../../components/Form/helper';
import validate from '../../../components/Form/validate';
import { makeSelectBalanceEntities } from '../../App/selectors';
import config from '../../../utils/config';
import type { BuyCoinPayload } from '../schema';
import { Loops } from '../utils';
import { AUTO_HIDE_SNACKBAR_TIME, STATE_SWAPS, TIME_LOOP } from '../constants';
import {
  loadBuyCoin,
  loadRecentSwaps,
  removeSwapsData,
  clearBuyCoinError,
  loadRecentSwapsError
} from '../actions';
import {
  makeSelectPricesLoading,
  makeSelectPricesEntities,
  makeSelectBuyingLoading,
  makeSelectBuyingError,
  makeSelectSwapsList,
  makeSelectSwapsEntities,
  makeSelectSwapsError,
  makeSelectSwapsLoading
} from '../selectors';
import AmountInput from './AmountInput';
import BuyButton from './BuyButton';
import CoinSelectable from './CoinSelectable';

const debug = require('debug')('dicoapp:containers:BuyPage:AmountSection');

const COIN_BASE = config.get('marketmaker.tokenconfig');

// eslint-disable-next-line react/prop-types
const TextInput = ({ onChange, value, error, isError, ...props }) => (
  <AmountInput
    {...props}
    error={isError}
    helperText={error}
    value={value}
    onChange={onChange}
  />
);

export const lessThan = (value: mixed, props: mixed) =>
  new Promise((resolve, reject) => {
    const { balance } = props;
    const n = Number(value);
    const b = Number(balance);
    if (n >= b) {
      return reject(new Error('Value is large than balance'));
    }
    return resolve(true);
  });

const ValidationBaseInput = validate(TextInput, [requiredNumber], {
  onChange: true
});

const ValidationPaymentInput = validate(TextInput, [requiredNumber, lessThan], {
  onChange: true
});

const styles = () => ({
  amountform: {
    width: '50%'
  },

  amountform__item: {
    width: '100%'
  },

  amountform__itemCenter: {
    textAlign: 'center'
  }
});

type Props = {
  // eslint-disable-next-line flowtype/no-weak-types
  classes: Object,
  paymentCoin: string,
  // eslint-disable-next-line flowtype/no-weak-types
  dispatchLoadBuyCoin: Function,
  // eslint-disable-next-line flowtype/no-weak-types
  dispatchLoadRecentSwaps: Function,
  // eslint-disable-next-line flowtype/no-weak-types
  dispatchRemoveSwapsData: Function,
  // eslint-disable-next-line flowtype/no-weak-types
  balance: Object,
  entities: Map<*, *>,
  buyingLoading: boolean,
  // eslint-dis,able-next-line flowtype/no-weak-types
  // buyingError: boolean | Object,
  swapsList: List<*>,
  swapsEntities: Map<*, *>,

  // eslint-disable-next-line flowtype/no-weak-types
  buyingError: boolean | Object,
  // eslint-disable-next-line flowtype/no-weak-types
  swapsError: boolean | Object,
  // eslint-disable-next-line flowtype/no-weak-types
  dispatchLoadRecentSwapsError: Function,
  // eslint-disable-next-line flowtype/no-weak-types
  dispatchClearBuyCoinError: Function,
  swapsLoading: boolean
};

type State = {
  disabledBuyButton: boolean,
  openSnackbar: boolean,
  snackbarMessage: string
};

class AmountSection extends Component<Props, State> {
  static defaultProps = {};

  constructor(props) {
    super(props);

    this.state = {
      disabledBuyButton: true,
      openSnackbar: false,
      snackbarMessage: ''
    };

    this.baseInput = React.createRef();
    this.paymentInput = React.createRef();
  }

  static getDerivedStateFromProps = (props, state) => {
    const { buyingError, swapsError } = props;
    const { openSnackbar } = state;
    if (openSnackbar === false && buyingError) {
      return {
        openSnackbar: true,
        snackbarMessage: buyingError.message
      };
    }
    if (openSnackbar === true && !buyingError) {
      return {
        openSnackbar: false,
        snackbarMessage: ''
      };
    }
    if (openSnackbar === false && swapsError) {
      return {
        openSnackbar: true,
        snackbarMessage: swapsError.message
      };
    }
    if (openSnackbar === true && !swapsError) {
      return {
        openSnackbar: false,
        snackbarMessage: ''
      };
    }
    return null;
  };

  componentDidMount = () => {
    const { dispatchLoadRecentSwaps } = this.props;

    dispatchLoadRecentSwaps();
  };

  componentDidUpdate(prevProps) {
    const { swapsList, swapsEntities, dispatchLoadRecentSwaps } = this.props;
    // eslint-disable-next-line react/destructuring-assignment
    if (swapsList.size === 1) {
      const entity = swapsEntities.get(swapsList.get(0));
      const oldEntity = prevProps.swapsEntities.get(swapsList.get(0));
      if (
        oldEntity &&
        oldEntity.get('sentflags').size === entity.get('sentflags').size
      )
        return;
      if (this.checkSwapStatusLoops) {
        this.checkSwapStatusLoops.cancel();
        this.checkSwapStatusLoops = undefined;
      }
      this.checkSwapStatusLoops = new Loops(TIME_LOOP, dispatchLoadRecentSwaps);
      this.checkSwapStatusLoops.setup();
      const delay =
        (entity.get('expiration') - Date.now() / 1000) * 1000 + TIME_LOOP;
      if (delay < 0) this.timeout();
      else {
        if (this.idClearState) {
          clearTimeout(this.idClearState);
          this.idClearState = undefined;
        }
        this.idClearState = setTimeout(this.timeout, delay);
      }
    }
  }

  componentWillUnmount = () => {
    if (this.checkSwapStatusLoops) {
      this.checkSwapStatusLoops.cancel();
      this.checkSwapStatusLoops = undefined;
    }
    if (this.idClearState) {
      clearTimeout(this.idClearState);
      this.idClearState = undefined;
    }
  };

  timeout = () => {
    if (this.checkSwapStatusLoops) {
      this.checkSwapStatusLoops.cancel();
      this.checkSwapStatusLoops = undefined;
    }
    const { dispatchLoadRecentSwapsError } = this.props;
    dispatchLoadRecentSwapsError('Timeout');
  };

  closeSnackbar = (evt, reason) => {
    if (reason !== 'clickaway') {
      const { dispatchClearBuyCoinError } = this.props;
      dispatchClearBuyCoinError();
    }
  };

  getBestPrice = () => {
    const { entities, paymentCoin } = this.props;
    const c = entities.get(paymentCoin);
    return c.get('bestPrice');
  };

  getBalance = () => {
    const { balance, paymentCoin } = this.props;
    if (!balance || !paymentCoin) return 0;

    const b = balance.get(paymentCoin);
    return b.get('balance');
  };

  controlBuyButton = (state: boolean) => {
    this.setState({
      disabledBuyButton: state
    });
  };

  onChangeBaseInput = async () => {
    try {
      const baseInput = this.baseInput.current;
      const base = await baseInput.value();
      this.controlBuyButton(false);

      const bestPrice = this.getBestPrice();
      const paymentInput = this.paymentInput.current;
      await paymentInput.setValue(base * bestPrice);
    } catch (err) {
      this.controlBuyButton(true);
      debug(`onChangeInput: ${err.message}`);
    }
  };

  onChangePaymentInput = async () => {
    try {
      const paymentInput = this.paymentInput.current;
      const payment = await paymentInput.value();
      this.controlBuyButton(false);

      const bestPrice = this.getBestPrice();
      const baseInput = this.baseInput.current;
      await baseInput.setValue(payment / bestPrice);
    } catch (err) {
      this.controlBuyButton(true);
      debug(`onChangeInput: ${err.message}`);
    }
  };

  onClickBuyCoinButton = async (evt: SyntheticInputEvent<>) => {
    evt.preventDefault();
    const { dispatchLoadBuyCoin, paymentCoin } = this.props;
    const baseInput = this.baseInput.current;
    const base = await baseInput.value();

    dispatchLoadBuyCoin({
      basecoin: COIN_BASE.coin,
      paymentcoin: paymentCoin,
      amount: Number(base)
    });
  };

  clickProcessButton = (evt: SyntheticInputEvent<>) => {
    evt.preventDefault();
    // const { swapsError, dispatchRemoveSwapsData } = this.props;
    const { dispatchRemoveSwapsData } = this.props;
    dispatchRemoveSwapsData();
    // if(swapsError) {

    // } else {

    // }
  };

  renderForm = () => {
    const { classes, paymentCoin, buyingLoading } = this.props;
    const { disabledBuyButton } = this.state;
    const disabled = paymentCoin === '';
    let label = 'SELECT YOUR PAYMENT';
    if (paymentCoin !== '') {
      label = paymentCoin;
    }

    return (
      <React.Fragment>
        {!buyingLoading && (
          <form>
            <ValidationBaseInput
              label={COIN_BASE.coin}
              id={COIN_BASE.coin}
              type="number"
              disabled={disabled}
              className={classes.amountform__item}
              ref={this.baseInput}
              onChange={this.onChangeBaseInput}
            />
            <br />
            <br />
            <SwapHorizIcon />
            <br />
            <br />
            <ValidationPaymentInput
              label={label}
              id={label}
              type="number"
              balance={this.getBalance()}
              disabled={disabled}
              className={classes.amountform__item}
              ref={this.paymentInput}
              onChange={this.onChangePaymentInput}
            />
            <br />
            <br />
            <BuyButton
              disabled={disabledBuyButton || buyingLoading}
              color="primary"
              variant="contained"
              className={classes.amountform__item}
              onClick={this.onClickBuyCoinButton}
            >
              Buy {COIN_BASE.coin}
            </BuyButton>
          </form>
        )}

        {buyingLoading && (
          <Grid container spacing={24}>
            <Grid item xs={6} className={classes.amountform__itemCenter}>
              <Typography variant="title" gutterBottom>
                Deposit
              </Typography>
              <Circle />
              <Line
                width={60}
                style={{
                  margin: '10px auto'
                }}
              />
            </Grid>
            <Grid item xs={6} className={classes.amountform__itemCenter}>
              <Typography variant="title" gutterBottom>
                Receive
              </Typography>
              <Circle />
              <Line
                width={60}
                style={{
                  margin: '10px auto'
                }}
              />
            </Grid>
            <Grid item xs={12} className={classes.amountform__itemCenter}>
              <Typography variant="body2" gutterBottom>
                Step {0}
                /6: {STATE_SWAPS[0]}
              </Typography>
              <LinearProgress color="primary" variant="determinate" value={0} />
            </Grid>
            <Grid item xs={12} className={classes.amountform__itemCenter}>
              <BuyButton
                disabled
                color="primary"
                variant="contained"
                className={classes.amountform__item}
              >
                Loading ...
              </BuyButton>
            </Grid>
          </Grid>
        )}
      </React.Fragment>
    );
  };

  renderProcess = () => {
    const {
      classes,
      swapsList,
      swapsEntities,
      swapsLoading,
      swapsError
    } = this.props;
    const entity = swapsEntities.get(swapsList.get(0));

    return (
      <Grid container spacing={24}>
        <Grid item xs={6} className={classes.amountform__itemCenter}>
          <CoinSelectable
            data="data"
            icon={getCoinIcon(entity.get('alice'))}
            title="Deposit"
            subTitle={
              <span>
                {entity.get('aliceamount')} {entity.get('alice')}
              </span>
            }
          />
        </Grid>
        <Grid item xs={6} className={classes.amountform__itemCenter}>
          <CoinSelectable
            data="data"
            icon={getCoinIcon(entity.get('bob'))}
            title="Receive"
            subTitle={
              <span>
                {entity.get('bobamount')} {entity.get('bob')}
              </span>
            }
          />
        </Grid>
        <Grid item xs={12} className={classes.amountform__itemCenter}>
          <Typography variant="body2" gutterBottom>
            Step {entity.get('sentflags').size + 1}
            /6: {STATE_SWAPS[entity.get('sentflags').size]}
          </Typography>
          <LinearProgress
            color="primary"
            variant="determinate"
            value={entity.get('sentflags').size * 20}
          />
        </Grid>
        <Grid item xs={12} className={classes.amountform__itemCenter}>
          <Typography variant="caption" gutterBottom>
            UUID: {entity.get('uuid')}
          </Typography>
        </Grid>
        <Grid item xs={12} className={classes.amountform__itemCenter}>
          <BuyButton
            disabled={swapsLoading}
            color="primary"
            variant="contained"
            className={classes.amountform__item}
            onClick={this.clickProcessButton}
          >
            {swapsLoading && <React.Fragment>Loading...</React.Fragment>}
            {!swapsLoading &&
              swapsError && <React.Fragment>Cancel</React.Fragment>}
            {!swapsLoading &&
              !swapsError && <React.Fragment>Done</React.Fragment>}
          </BuyButton>
        </Grid>
      </Grid>
    );
  };

  render() {
    debug(`render`);
    const { classes, swapsList } = this.props;
    const { openSnackbar, snackbarMessage } = this.state;

    return (
      <div className={classes.amountform}>
        {swapsList.size === 0 && this.renderForm()}
        {swapsList.size !== 0 && this.renderProcess()}

        <Snackbar
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'center'
          }}
          open={openSnackbar}
          autoHideDuration={AUTO_HIDE_SNACKBAR_TIME}
          onClose={this.closeSnackbar}
          ContentProps={{
            'aria-describedby': 'message-id'
          }}
          message={<span id="message-id">{snackbarMessage}</span>}
          action={[
            <IconButton
              key="close"
              aria-label="Close"
              color="inherit"
              onClick={this.closeSnackbar}
            >
              <CloseIcon />
            </IconButton>
          ]}
        />
      </div>
    );
  }
}

AmountSection.displayName = 'AmountSection';

export function mapDispatchToProps(dispatch: Dispatch<Object>) {
  return {
    dispatchLoadBuyCoin: (payload: BuyCoinPayload) =>
      dispatch(loadBuyCoin(payload)),
    dispatchLoadRecentSwaps: () => dispatch(loadRecentSwaps()),
    dispatchRemoveSwapsData: () => dispatch(removeSwapsData()),
    dispatchClearBuyCoinError: () => dispatch(clearBuyCoinError()),
    dispatchLoadRecentSwapsError: (message: string) =>
      dispatch(loadRecentSwapsError(message))
  };
}

const mapStateToProps = createStructuredSelector({
  loading: makeSelectPricesLoading(),
  entities: makeSelectPricesEntities(),
  balance: makeSelectBalanceEntities(),
  buyingLoading: makeSelectBuyingLoading(),
  buyingError: makeSelectBuyingError(),
  swapsList: makeSelectSwapsList(),
  swapsEntities: makeSelectSwapsEntities(),
  swapsError: makeSelectSwapsError(),
  swapsLoading: makeSelectSwapsLoading()
});

const withConnect = connect(
  mapStateToProps,
  mapDispatchToProps
);

export default compose(
  withConnect,
  withStyles(styles)
)(AmountSection);
