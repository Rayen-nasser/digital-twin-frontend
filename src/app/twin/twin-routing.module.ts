import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { CreateTwinComponent } from './components/create-twin/create-twin.component';
import { ListTwinComponent } from './components/list-twin/list-twin.component';
import { DetailTwinComponent } from './components/detail-twin/detail-twin.component';

const routes: Routes = [
  { path: '', component: ListTwinComponent },
  { path: 'mine', component: ListTwinComponent },
  { path: 'public', component: ListTwinComponent },
  { path: 'create', component: CreateTwinComponent },
  { path: ':id', component: DetailTwinComponent}
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AuthRoutingModule {}
