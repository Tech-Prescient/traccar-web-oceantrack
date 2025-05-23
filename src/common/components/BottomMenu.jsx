import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Paper, BottomNavigation, BottomNavigationAction, Menu, MenuItem, Typography, Badge,
} from '@mui/material';
import dayjs from 'dayjs';

import DescriptionIcon from '@mui/icons-material/Description';
import SettingsIcon from '@mui/icons-material/Settings';
import MapIcon from '@mui/icons-material/Map';
import PersonIcon from '@mui/icons-material/Person';
import SetMealIcon from '@mui/icons-material/SetMeal';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';

import { sessionActions } from '../../store';
import { useTranslation } from './LocalizationProvider';
import { useRestriction } from '../util/permissions';
import { nativePostMessage } from './NativeInterface';
import { addCatchestoMap ,removeFishCatchFromMap} from './FishCatchPlot';
import { catchActions } from '../../store/catch';

const BottomMenu = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const t = useTranslation();

  const readonly = useRestriction('readonly');
  const disableReports = useRestriction('disableReports');
  const user = useSelector((state) => state.session.user);
  const socket = useSelector((state) => state.session.socket);
  const [anchorEl, setAnchorEl] = useState(null);
  const [isFishCatchSelected, setFishCatchSelected] = useState(false);

  useEffect(() => {
    setFishCatchSelected(false);
    removeFishCatchFromMap();
    dispatch(dispatch(catchActions.clearDetails()));
  }, []);
  
  const currentSelection = () => {
    if (location.pathname === `/settings/user/${user.id}`) {
      return 'account';
    } if (location.pathname.startsWith('/settings')) {
      return 'settings';
    } if (location.pathname.startsWith('/reports')) {
      return 'reports';
    } if (location.pathname === '/') {
      return 'map';
    }
    return null;
  };

  const handleAccount = () => {
    setAnchorEl(null);
    navigate(`/settings/user/${user.id}`);
  };

  const handleLogout = async () => {
    setAnchorEl(null);

    const notificationToken = window.localStorage.getItem('notificationToken');
    if (notificationToken && !user.readonly) {
      window.localStorage.removeItem('notificationToken');
      const tokens = user.attributes.notificationTokens?.split(',') || [];
      if (tokens.includes(notificationToken)) {
        const updatedUser = {
          ...user,
          attributes: {
            ...user.attributes,
            notificationTokens: tokens.length > 1 ? tokens.filter((it) => it !== notificationToken).join(',') : undefined,
          },
        };
        await fetch(`/api/users/${user.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedUser),
        });
      }
    }

    await fetch('/api/session', { method: 'DELETE' });
    nativePostMessage('logout');
    navigate('/login');
    dispatch(sessionActions.updateUser(null));
  };

  const onCatchClick = (catchDetails) => {
    dispatch(catchActions.catchDetails(catchDetails));
  }

  const plotFishCatchData = async () => {
    if (!isFishCatchSelected) {
      const tokenExpiration = dayjs().add(5, 'minute').toISOString();
      const tokenResponse = await fetch('/api/session/token', {
        method: 'POST',
        body: new URLSearchParams(`expiration=${tokenExpiration}`),
      });
      if (tokenResponse.ok) {
        let token = await tokenResponse.text();
        const fishRecordsResponse = await fetch(`${import.meta.env.VITE_FISHCATCH_API_BASE_URL}${import.meta.env.VITE_FISHCATCH_API_PATH}`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
        })
        if (fishRecordsResponse.ok) {
          let records = await fishRecordsResponse.json();
          records = records.map((r) => { return { ...r, ...{ vesselId: r.id,vesselName:r.vessel_name,catchDetails:r.details,catchDate: r.details[0].catch_date,longitude:Number(r.details[0].longitude),latitude:Number(r.details[0].latitude),totalQuantity:r.details.reduce((i,j)=>Number(i)+j.quantity,0) } } });
          dispatch(catchActions.setCatchRecords(records));
          addCatchestoMap(records,onCatchClick);
        }
      } else {
        throw Error(await response1);
      }
              
      
    }
    else
      removeFishCatchFromMap();
    setFishCatchSelected((val) => !val);
  }

  const handleSelection = (event, value) => {
    switch (value) {
      case 'map':
        navigate('/');
        break;
      case 'reports':
        navigate('/reports/route');
        break;
      case 'settings':
        navigate('/settings/preferences');
        break;
      case 'account':
        setAnchorEl(event.currentTarget);
        break;
      case 'logout':
        handleLogout();
        break;
      case 'fishCatch':
        plotFishCatchData();
        break;
      default:
        break;
    }
  };

  return (
    <Paper square elevation={3}>
      <BottomNavigation value={currentSelection()} onChange={handleSelection} showLabels>
        <BottomNavigationAction
          label={t('mapTitle')}
          icon={(
            <Badge color="error" variant="dot" overlap="circular" invisible={socket !== false}>
              <MapIcon />
            </Badge>
          )}
          value="map"
        />
        <BottomNavigationAction
          style={{color:isFishCatchSelected&&'#1a237e'}}
          label={t('catch')}
          icon={(<SetMealIcon />)}
          value="fishCatch"
        />
        {!disableReports && (
          <BottomNavigationAction label={t('reportTitle')} icon={<DescriptionIcon />} value="reports" />
        )}
        <BottomNavigationAction label={t('settingsTitle')} icon={<SettingsIcon />} value="settings" />
        {readonly ? (
          <BottomNavigationAction label={t('loginLogout')} icon={<ExitToAppIcon />} value="logout" />
        ) : (
          <BottomNavigationAction label={t('settingsUser')} icon={<PersonIcon />} value="account" />
        )}
      </BottomNavigation>
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
        <MenuItem onClick={handleAccount}>
          <Typography color="textPrimary">{t('settingsUser')}</Typography>
        </MenuItem>
        <MenuItem onClick={handleLogout}>
          <Typography color="error">{t('loginLogout')}</Typography>
        </MenuItem>
      </Menu>
    </Paper>
  );
};

export default BottomMenu;
